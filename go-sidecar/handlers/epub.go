package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/ABFCode/Spine"
)

// ParseEpubRequest is the request body for parsing
type ParseEpubRequest struct {
	FilePath string `json:"file_path"`
}

// EpubMetadata contains book metadata
type EpubMetadata struct {
	Title       string   `json:"title"`
	Author      string   `json:"author"`
	Language    string   `json:"language"`
	Description string   `json:"description"`
	Publisher   string   `json:"publisher"`
	Subjects    []string `json:"subjects"`
}

// Chapter represents a single chapter
type Chapter struct {
	SpineIndex int    `json:"spine_index"`
	Title      string `json:"title"`
	Content    string `json:"content"`
	WordCount  int    `json:"word_count"`
}

// ProgressEvent is sent during SSE streaming
type ProgressEvent struct {
	Type    string `json:"type"` // "progress", "complete", "error"
	Current int    `json:"current,omitempty"`
	Total   int    `json:"total,omitempty"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`

	// Only on "complete"
	Metadata         *EpubMetadata `json:"metadata,omitempty"`
	Chapters         []Chapter     `json:"chapters,omitempty"`
	CoverImage       []byte        `json:"cover_image,omitempty"`
	CoverContentType string        `json:"cover_content_type,omitempty"`
}

// HandleParseEpub handles EPUB parsing requests with SSE streaming
func HandleParseEpub(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ParseEpubRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.FilePath == "" {
		http.Error(w, "file_path is required", http.StatusBadRequest)
		return
	}

	// Require an absolute, cleaned path. The host always supplies absolute paths
	// chosen via a native file dialog; rejecting anything else avoids surprises
	// from relative or traversal-style inputs.
	if !filepath.IsAbs(req.FilePath) || filepath.Clean(req.FilePath) != req.FilePath {
		http.Error(w, "file_path must be an absolute, normalized path", http.StatusBadRequest)
		return
	}

	// Set up SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming not supported", http.StatusInternalServerError)
		return
	}

	// Helper to send SSE event
	sendEvent := func(event ProgressEvent) {
		data, _ := json.Marshal(event)
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
	}

	// Send initial progress
	sendEvent(ProgressEvent{
		Type:    "progress",
		Current: 0,
		Total:   100,
		Message: "Opening EPUB file...",
	})

	// Parse the EPUB using Spine
	book, err := spine.ParseFile(req.FilePath)
	if err != nil {
		sendEvent(ProgressEvent{
			Type:  "error",
			Error: "Failed to parse EPUB: " + err.Error(),
		})
		return
	}

	sendEvent(ProgressEvent{
		Type:    "progress",
		Current: 10,
		Total:   100,
		Message: "Extracting metadata...",
	})

	// Extract metadata
	description := ""
	if len(book.Metadata.Descriptions) > 0 {
		description = book.Metadata.Descriptions[0].Value
	}

	subjects := make([]string, 0, len(book.Metadata.Subjects))
	for _, s := range book.Metadata.Subjects {
		subjects = append(subjects, s.Value)
	}

	metadata := &EpubMetadata{
		Title:       book.Metadata.Title,
		Author:      strings.Join(book.Metadata.Authors, ", "),
		Language:    book.Metadata.Language,
		Description: description,
		Publisher:   book.Metadata.Publisher,
		Subjects:    subjects,
	}

	// Try to get cover
	var coverImage []byte
	var coverContentType string
	if cover, err := book.Cover(); err == nil {
		coverImage = cover.Bytes
		coverContentType = cover.ContentType
	}

	sendEvent(ProgressEvent{
		Type:    "progress",
		Current: 20,
		Total:   100,
		Message: "Extracting chapters...",
	})

	// Extract chapters using Spine's Chapters() API
	chapterOpts := spine.ChapterOptions{
		TitleSource: spine.TitleAuto,
	}

	spineChapters, err := book.Chapters(chapterOpts)
	if err != nil {
		sendEvent(ProgressEvent{
			Type:  "error",
			Error: "Failed to extract chapters: " + err.Error(),
		})
		return
	}

	chapters := make([]Chapter, 0, len(spineChapters))
	total := len(spineChapters)

	for i, ch := range spineChapters {
		// Calculate progress (20-95%)
		progress := 20 + int(float64(i+1)/float64(total)*75)

		// Send progress update every 10 chapters or on last chapter
		if i%10 == 0 || i == total-1 {
			sendEvent(ProgressEvent{
				Type:    "progress",
				Current: progress,
				Total:   100,
				Message: fmt.Sprintf("Processing chapter %d of %d...", i+1, total),
			})
		}

		chapters = append(chapters, Chapter{
			SpineIndex: ch.SpineIndex,
			Title:      ch.Title,
			Content:    ch.Text,
			WordCount:  countWords(ch.Text),
		})
	}

	// Send completion event with all data
	sendEvent(ProgressEvent{
		Type:             "complete",
		Current:          100,
		Total:            100,
		Message:          "Complete",
		Metadata:         metadata,
		Chapters:         chapters,
		CoverImage:       coverImage,
		CoverContentType: coverContentType,
	})
}

// ExportEpubRequest is the request body for exporting
type ExportEpubRequest struct {
	OutputPath       string          `json:"output_path"`
	Metadata         *EpubMetadata   `json:"metadata"`
	Chapters         []ExportChapter `json:"chapters"`
	CoverImage       []byte          `json:"cover_image,omitempty"`
	CoverContentType string          `json:"cover_content_type,omitempty"`
}

// ExportChapter for export operations
type ExportChapter struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

// ExportEpubResponse is the response for exporting
type ExportEpubResponse struct {
	Success  bool   `json:"success"`
	FilePath string `json:"file_path,omitempty"`
	Error    string `json:"error,omitempty"`
}

// HandleExportEpub handles EPUB export requests
func HandleExportEpub(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req ExportEpubRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, "Invalid request body: "+err.Error())
		return
	}

	// Require an absolute, normalized destination path before any disk write.
	if req.OutputPath == "" || !filepath.IsAbs(req.OutputPath) || filepath.Clean(req.OutputPath) != req.OutputPath {
		respondWithError(w, "output_path must be an absolute, normalized path")
		return
	}

	// TODO: Implement EPUB export using Spine or another library
	// For now, return a not implemented response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ExportEpubResponse{
		Success: false,
		Error:   "EPUB export not yet implemented",
	})
}

func respondWithError(w http.ResponseWriter, message string) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": false,
		"error":   message,
	})
}

// countWords counts words in a string
func countWords(s string) int {
	words := 0
	inWord := false

	for _, r := range s {
		isSpace := r == ' ' || r == '\n' || r == '\t' || r == '\r'
		if !isSpace && !inWord {
			words++
			inWord = true
		} else if isSpace {
			inWord = false
		}
	}

	return words
}
