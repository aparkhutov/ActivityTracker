#include "HttpServer.h"
#include "Constants.h"

int main() {    
    HttpServer server(Const::PUBLIC_DIR);
    if (server.start(8080)) {
        server.run();
    }
    return 0;
}
