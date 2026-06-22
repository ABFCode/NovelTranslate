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

	// Shared secret used to authenticate requests from the Electron host.
	// Passed via env so it never appears in the process arg list.
	authToken := os.Getenv("SIDECAR_TOKEN")

	// Bind to loopback only so the sidecar is not reachable from other hosts
	// on the network.
	listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", *port))
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

	// requireAuth wraps a handler so it only runs when the request carries the
	// shared secret. If no token was configured (e.g. ad-hoc local debugging),
	// the gate is a no-op.
	requireAuth := func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			if authToken != "" && r.Header.Get("X-Sidecar-Token") != authToken {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}
			next(w, r)
		}
	}

	// Health endpoint (authenticated like everything else)
	mux.HandleFunc("/health", requireAuth(func(w http.ResponseWriter, r *http.Request) {
		uptime := time.Since(startTime).Seconds()
		json.NewEncoder(w).Encode(map[string]interface{}{
			"healthy":        true,
			"version":        version,
			"uptime_seconds": int64(uptime),
		})
	}))

	// EPUB parse endpoint
	mux.HandleFunc("/epub/parse", requireAuth(handlers.HandleParseEpub))

	// EPUB export endpoint
	mux.HandleFunc("/epub/export", requireAuth(handlers.HandleExportEpub))

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
