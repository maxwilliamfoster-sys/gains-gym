"""Tiny one-shot receiver for tools/thumbnail.js: accepts PNG data-URL POSTs and saves them.

    py tools/receive.py thumbnail.png [port]

Saves each POST to the given path, overwriting, until a POST of the string "done".
"""
import base64, sys, threading
from http.server import BaseHTTPRequestHandler, HTTPServer

OUT = sys.argv[1] if len(sys.argv) > 1 else "thumbnail.png"
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8651


class H(BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode()
        self.send_response(204); self.send_header("Access-Control-Allow-Origin", "*"); self.end_headers()
        if body == "done":   # shut down from another thread (raising here is swallowed by socketserver)
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return
        with open(OUT, "wb") as f:
            f.write(base64.b64decode(body.split(",", 1)[1]))
        print("saved", OUT, flush=True)

    def log_message(self, *a):
        pass


HTTPServer(("127.0.0.1", PORT), H).serve_forever()
