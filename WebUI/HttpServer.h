#pragma once
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <winsock2.h>
#include <string>
#include <vector>
#include "Types.h"

class HttpServer {
private:
    SOCKET srv;
    std::vector<DataPoint> data;
    std::vector<Tag> tags;
    std::string pub;

    bool loadCSV(const std::string& fn);
    bool loadTags(const std::string& fn);
    bool saveTags(const std::string& fn);
    bool addTag(const std::string& fn, const Tag& nt);
    bool delTag(const std::string& fn, int start);
    bool genJSON(const std::string& fn);
    
    std::string mime(const std::string& p);
    std::string readFile(const std::string& fn);
    void respond(SOCKET s, const std::string& r);
    void handleAPI(SOCKET s, const std::string& method, const std::string& path, const std::string& body);
    void handle(SOCKET s, const std::string& req);

public:
    HttpServer(const std::string& pd);
    ~HttpServer();
    
    bool start(int port);
    void run();
};
