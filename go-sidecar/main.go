package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/noveltranslate/go-sidecar/handlers"
)

const version = "0.1.0"

var startTime = time.Now()

func main() {
	// Parse command line flags
	port := flag.Int("port", 0, "Port to listen on (0 for random)")
	flag.Parse()

	// Find available port
	listener, err := net.Listen("tcp", fmt.Sprintf(":%d", *port))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to listen: %v\n", err)
		os.Exit(1)
	}

	// Get the actual port (important if port was 0)
	addr := listener.Addr().(*net.TCPAddr)
	actualPort := addr.Port

	// Print port to stdout for Electron to read
	fmt.Printf("PORT:%d\n", actualPort)

	// Create HTTP server
	mux := http.NewServeMux()

	// Health endpoint
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		uptime := time.Since(startTime).Seconds()
		json.NewEncoder(w).Encode(map[string]interface{}{
			"healthy":        true,
			"version":        version,
			"uptime_seconds": int64(uptime),
		})
	})

	// EPUB parse endpoint
	mux.HandleFunc("/epub/parse", handlers.HandleParseEpub)

	// EPUB export endpoint
	mux.HandleFunc("/epub/export", handlers.HandleExportEpub)

	server := &http.Server{Handler: mux}

	// Handle graceful shutdown
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan

		fmt.Println("Shutting down gracefully...")
		server.Close()
	}()

	// Start serving
	fmt.Printf("NovelTranslate Sidecar v%s listening on port %d\n", version, actualPort)
	if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
		fmt.Fprintf(os.Stderr, "Failed to serve: %v\n", err)
		os.Exit(1)
	}
}
