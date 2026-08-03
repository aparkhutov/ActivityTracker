#pragma once
#include <string>

struct DataPoint { 
    int p; 
    int d; 
    int status; 
};

struct Tag { 
    int start; 
    int duration; 
    std::string name; 
};
