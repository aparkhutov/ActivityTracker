#pragma once

#include <string>

namespace Utils
{
  std::wstring GetSanitizedUsername();
  std::wstring GetConnectionStatus();
  int GetIdleSeconds();
  std::pair<std::wstring, std::wstring> GetActiveWindowInfo();
  std::string WideToUtf8(const std::wstring &wstr);
  std::wstring SanitizeField(const std::wstring &field);
  bool EnsureDirectoryExists(const std::wstring &folderPath);
  std::wstring GetFilePathWithPrefix(const std::wstring &folderPath, const std::wstring &datePrefix);
  std::wstring GetSanitizedUsername();
}