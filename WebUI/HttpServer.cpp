#include "HttpServer.h"
#include "Constants.h"
#include <shellapi.h>
#include <fstream>
#include <sstream>
#include <algorithm>
#include <regex>

HttpServer::HttpServer(const std::string& pd) : srv(INVALID_SOCKET), pub(pd) {}

HttpServer::~HttpServer() {
    if (srv != INVALID_SOCKET) {
        closesocket(srv);
    }
    WSACleanup();
}

bool HttpServer::loadCSV(const std::string& fn) {
    data.clear();
    std::ifstream f(fn);
    if (!f.is_open()) return false;
    
    std::string line;
    while (std::getline(f, line)) {
        if (line.empty()) continue;
        std::stringstream ss(line);
        DataPoint dp;
        std::string t;
        if (getline(ss, t, ',')) dp.p = std::stoi(t);
        if (getline(ss, t, ',')) dp.d = std::stoi(t);
        if (getline(ss, t, ',')) dp.status = std::stoi(t);
        data.push_back(dp);
    }
    f.close();
    return !data.empty();
}

bool HttpServer::loadTags(const std::string& fn) {
    tags.clear();
    std::ifstream f(fn);
    if (!f.is_open()) {
        std::ofstream newFile(fn);
        newFile.close();
        return true;
    }
    std::string line;
    while (std::getline(f, line)) {
        if (line.empty()) continue;
        std::stringstream ss(line);
        Tag t;
        std::string tok;
        if (getline(ss, tok, ',')) t.start = std::stoi(tok);
        if (getline(ss, tok, ',')) t.duration = std::stoi(tok);
        if (getline(ss, tok, ',')) t.name = tok;
        tags.push_back(t);
    }
    f.close();
    return true;
}

bool HttpServer::saveTags(const std::string& fn) {
    std::ofstream f(fn);
    if (!f.is_open()) return false;
    for (const auto& t : tags) {
        f << t.start << "," << t.duration << "," << t.name << "\n";
    }
    f.close();
    return true;
}

bool HttpServer::addTag(const std::string& fn, const Tag& nt) {
    auto it = std::find_if(tags.begin(), tags.end(),
        [&nt](const Tag& t) { return t.start == nt.start; });
    if (it != tags.end()) {
        it->duration = nt.duration;
        it->name = nt.name;
    } else {
        tags.push_back(nt);
    }
    std::sort(tags.begin(), tags.end(),
        [](const Tag& a, const Tag& b) { return a.start < b.start; });
    return saveTags(fn);
}

bool HttpServer::delTag(const std::string& fn, int start) {
    auto it = std::find_if(tags.begin(), tags.end(),
        [start](const Tag& t) { return t.start == start; });
    if (it == tags.end()) return false;
    tags.erase(it);
    return saveTags(fn);
}

bool HttpServer::genJSON(const std::string& fn) {
    std::ofstream f(fn);
    if (!f.is_open()) return false;
        
    int totalP = 0, totalD = 0, green = 0, red = 0, gs = 0, rs = 0;
    for (const auto& dp : data) {
        totalD += dp.d;
        if (dp.status == 1) { green++; gs += dp.d; }
        else { red++; rs += dp.d; }
    }
    if (!data.empty()) totalP = data.back().p + data.back().d;
    
    f << "{\n \"data\": [\n";
    for (size_t i = 0; i < data.size(); ++i) {
        const auto& dp = data[i];
        f << "  {\"index\":" << (i + 1) << ",\"p\":" << dp.p
          << ",\"d\":" << dp.d << ",\"status\":" << dp.status << "}";
        if (i < data.size() - 1) f << ",";
        f << "\n";
    }
    f << " ],\n \"total\":" << data.size()
      << ",\n \"totalP\":" << totalP << ",\n \"totalD\":" << totalD
      << ",\n \"stats\": {\"active\":" << green << ",\"inactive\":" << red
      << ",\"activeSum\":" << gs << ",\"inactiveSum\":" << rs << "},\n \"tags\": [\n";
      
    for (size_t i = 0; i < tags.size(); ++i) {
        const auto& t = tags[i];
        f << "  {\"start\":" << t.start << ",\"duration\":" << t.duration
          << ",\"name\":\"" << t.name << "\"}";
        if (i < tags.size() - 1) f << ",";
        f << "\n";
    }
    f << " ]\n}\n";
    f.close();
    return true;
}

std::string HttpServer::mime(const std::string& p) {
    if (p.find(".html") != std::string::npos) return Const::MIME_HTML;
    if (p.find(".css") != std::string::npos) return Const::MIME_CSS;
    if (p.find(".js") != std::string::npos) return Const::MIME_JS;
    if (p.find(".json") != std::string::npos) return Const::MIME_JSON;
    if (p.find(".png") != std::string::npos) return Const::MIME_PNG;
    if (p.find(".jpg") != std::string::npos) return Const::MIME_JPG;
    if (p.find(".gif") != std::string::npos) return Const::MIME_GIF;
    if (p.find(".svg") != std::string::npos) return Const::MIME_SVG;
    return Const::MIME_DEF;
}

std::string HttpServer::readFile(const std::string& fn) {
    std::ifstream f(fn, std::ios::binary);
    if (!f.is_open()) return "";
    f.seekg(0, std::ios::end);
    size_t sz = f.tellg();
    f.seekg(0, std::ios::beg);
    std::string s(sz, '\0');
    if (sz > 0) f.read(&s[0], sz);
    f.close();
    return s;
}

void HttpServer::respond(SOCKET s, const std::string& r) {
    send(s, r.c_str(), static_cast<int>(r.length()), 0);
}


void HttpServer::handleAPI(SOCKET s, const std::string& method, const std::string& path, const std::string& body) {
    if (path == Const::API_TAGS && method == "POST") {
        std::string r = Const::httpOk(Const::MIME_JSON);
        try {
            Tag t;
            std::smatch m;
            if (!std::regex_search(body, m, std::regex("\"start\"\\s*:\\s*(\\d+)")) || m.size() < 2)
                throw std::runtime_error("Missing start");
            t.start = std::stoi(m[1].str());
            
            if (!std::regex_search(body, m, std::regex("\"duration\"\\s*:\\s*(\\d+)")) || m.size() < 2)
                throw std::runtime_error("Missing duration");
            t.duration = std::stoi(m[1].str());
            
            t.name = "";
            if (std::regex_search(body, m, std::regex("\"name\"\\s*:\\s*\"([^\"]*)\"")) && m.size() > 1)
                t.name = m[1].str();
                
            r += addTag(Const::CSV_TAGS, t) && genJSON(pub + Const::JSON_DATA)
                ? Const::JSON_SUCCESS_TRUE : Const::JSON_SAVE_FAIL;
        }
        catch (const std::exception& e) {
            r += "{\"success\":false,\"message\":\"" + std::string(e.what()) + "\"}";
        }
        respond(s, r);
        return;
    }
    
    if (path == Const::API_TAGS && method == "DELETE") {
        std::string r = Const::httpOk(Const::MIME_JSON);
        try {
            std::smatch m;
            if (!std::regex_search(body, m, std::regex("\"start\"\\s*:\\s*(\\d+)")) || m.size() < 2)
                throw std::runtime_error("Missing start");
            int st = std::stoi(m[1].str());
            
            r += delTag(Const::CSV_TAGS, st) && genJSON(pub + Const::JSON_DATA)
                ? Const::JSON_DEL_OK : Const::JSON_NOT_FOUND;
        }
        catch (const std::exception& e) {
            r += "{\"success\":false,\"message\":\"" + std::string(e.what()) + "\"}";
        }
        respond(s, r);
        return;
    }
    respond(s, Const::HTTP_404);
}

void HttpServer::handle(SOCKET s, const std::string& req) {
    size_t p1 = req.find(' '), p2 = req.find(' ', p1 + 1);
    if (p1 == std::string::npos || p2 == std::string::npos) return;
    std::string method = req.substr(0, p1);
    std::string path = req.substr(p1 + 1, p2 - p1 - 1);
    
    size_t qpos = path.find('?');
    if (qpos != std::string::npos) path = path.substr(0, qpos);

    std::string body;
    size_t bp = req.find(Const::CRLF2);
    if (bp != std::string::npos) body = req.substr(bp + 4);
        
    if (path.find(Const::API_PREFIX) == 0) {
        handleAPI(s, method, path, body);
        return;
    }
    
    if (path == "/" || path == "") path = Const::INDEX_HTML;
        
    std::string fp = pub + path;
    if (path.find("..") != std::string::npos) {
        respond(s, Const::HTTP_403);
        return;
    }
    
    std::string content = readFile(fp);
    if (content.empty()) {
        respond(s, Const::HTTP_404);
        return;
    }
    
    std::stringstream rs;
    rs << Const::httpOkHeaders(mime(path))
       << Const::HDR_CL << content.length() << Const::CRLF
       << Const::HDR_CONN << Const::HDR_CACHE << Const::CRLF << content;
    respond(s, rs.str());
}

bool HttpServer::start(int port) {
    if (!loadCSV(Const::CSV_DATA)) return false;
    if (!loadTags(Const::CSV_TAGS)) return false;
    if (!genJSON(pub + Const::JSON_DATA)) return false;
    
    WSADATA wd;
    if (WSAStartup(MAKEWORD(2, 2), &wd)) return false;
    
    srv = socket(AF_INET, SOCK_STREAM, 0);
    if (srv == INVALID_SOCKET) {
        WSACleanup();
        return false;
    }
    
    int opt = 1;
    setsockopt(srv, SOL_SOCKET, SO_REUSEADDR, (char*)&opt, sizeof(opt));
    
    sockaddr_in addr;
    addr.sin_family = AF_INET;
    addr.sin_port = htons(static_cast<USHORT>(port));
    addr.sin_addr.s_addr = INADDR_ANY;
    
    if (bind(srv, (sockaddr*)&addr, sizeof(addr)) == SOCKET_ERROR) {
        closesocket(srv);
        WSACleanup();
        return false;
    }
    
    if (listen(srv, SOMAXCONN) == SOCKET_ERROR) {
        closesocket(srv);
        WSACleanup();
        return false;
    }
    
    printf("[OK] Server listening at http://localhost:%d\n", port);
    
    std::string url = "http://localhost:" + std::to_string(port);
    ShellExecuteA(NULL, "open", url.c_str(), NULL, NULL, SW_SHOWNORMAL);
    
    return true;
}

void HttpServer::run() {
    if (srv == INVALID_SOCKET) return;
    while (true) {
        SOCKET c = accept(srv, NULL, NULL);
        if (c == INVALID_SOCKET) continue;
        
        char buf[8192]; 
        int n = recv(c, buf, sizeof(buf) - 1, 0);
        if (n > 0) {
            buf[n] = 0;
            handle(c, std::string(buf));
        }
        closesocket(c);
    }
}
