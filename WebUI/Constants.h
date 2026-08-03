#pragma once
#include <string>

namespace Const {
    const char* const CSV_DATA = "data.csv";
    const char* const CSV_TAGS = "tags.csv";
    const char* const JSON_DATA = "/data.json";
    const char* const INDEX_HTML = "/index.html";
    const char* const PUBLIC_DIR = "./public";
    const char* const API_TAGS = "/api/tags";
    const char* const API_PREFIX = "/api/";
    
    const char* const MIME_HTML = "text/html; charset=utf-8";
    const char* const MIME_CSS = "text/css; charset=utf-8";
    const char* const MIME_JS = "application/javascript; charset=utf-8";
    const char* const MIME_JSON = "application/json; charset=utf-8";
    const char* const MIME_PNG = "image/png";
    const char* const MIME_JPG = "image/jpeg";
    const char* const MIME_GIF = "image/gif";
    const char* const MIME_SVG = "image/svg+xml";
    const char* const MIME_DEF = "text/plain";
    
    const char* const HTTP_404 = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
    const char* const HTTP_403 = "HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
    
    const char* const HDR_CT = "Content-Type: ";
    const char* const HDR_CL = "Content-Length: ";
    const char* const HDR_CONN = "Connection: close\r\n";
    const char* const HDR_CACHE = "Cache-Control: no-cache\r\n";
    const char* const CRLF = "\r\n";
    const char* const CRLF2 = "\r\n\r\n";
    
    const char* const JSON_SUCCESS_TRUE = "{\"success\":true,\"message\":\"Tag saved\"}";
    const char* const JSON_DEL_OK = "{\"success\":true,\"message\":\"Tag deleted\"}";
    const char* const JSON_SAVE_FAIL = "{\"success\":false,\"message\":\"Failed to save tag\"}";
    const char* const JSON_NOT_FOUND = "{\"success\":false,\"message\":\"Tag not found\"}";

    inline std::string httpOkHeaders(const std::string& mime) {
        return std::string("HTTP/1.1 200 OK\r\nContent-Type: ") + mime + "\r\n";
    }

    inline std::string httpOk(const std::string& mime) {
        return std::string("HTTP/1.1 200 OK\r\nContent-Type: ") + mime + "\r\nConnection: close\r\n\r\n";
    }
}
