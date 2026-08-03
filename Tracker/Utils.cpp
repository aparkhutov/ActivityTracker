#include <windows.h>
#include <lmcons.h>
#include <wtsapi32.h>
#include <memory>

#include "Utils.h"

namespace
{
  inline void Sanitize(wchar_t *buf, DWORD count)
  {
    while (count--)
    {
      wchar_t ch = *buf;
      if ((ch < L'a' || ch > L'z') && (ch < L'A' || ch > L'Z') && (ch < L'0' || ch > L'9'))
        *buf = L'_';
      ++buf;
    }
  }
}

BOOL CALLBACK EnumUwpChildWindowsProc(HWND hwnd, LPARAM lParam)
{
  DWORD *pTargetPid = reinterpret_cast<DWORD *>(lParam);
  DWORD childPid = 0;
  ::GetWindowThreadProcessId(hwnd, &childPid);

  if (childPid != 0)
  {
    DWORD hostPid = *pTargetPid;
    if (childPid != hostPid)
    {
      *pTargetPid = childPid;
      return FALSE;
    }
  }
  return TRUE;
}

std::wstring Utils::GetConnectionStatus()
{
  const std::wstring STATUS_OFF = L"off";
  const std::wstring STATUS_CONSOLE = L"console";
  const std::wstring STATUS_RDP = L"rdp";
  const std::wstring STATUS_UNKNOWN = L"unknown";

  auto wtsDeleter = [](void *ptr){ if (ptr) ::WTSFreeMemory(ptr); };
  std::unique_ptr<void, decltype(wtsDeleter)> guard(nullptr, wtsDeleter);
  LPWSTR pBuffer = nullptr;
  DWORD bytesReturned = 0;

  if (::WTSQuerySessionInformationW(WTS_CURRENT_SERVER_HANDLE, WTS_CURRENT_SESSION, WTSConnectState, &pBuffer, &bytesReturned))
  {
    guard.reset(pBuffer);
    if (bytesReturned >= sizeof(WTS_CONNECTSTATE_CLASS))
    {
      auto state = *reinterpret_cast<WTS_CONNECTSTATE_CLASS *>(static_cast<void *>(pBuffer));
      if (state != WTSActive)
      {
        return STATUS_OFF;
      }
    }
  }

  if (::WTSQuerySessionInformationW(WTS_CURRENT_SERVER_HANDLE, WTS_CURRENT_SESSION, WTSSessionInfoEx, &pBuffer, &bytesReturned))
  {
    guard.reset(pBuffer);
    if (bytesReturned >= sizeof(WTSINFOEXW))
    {
      auto infoEx = reinterpret_cast<PWTSINFOEXW>(static_cast<void *>(pBuffer));
      if (infoEx->Level == 1 && (infoEx->Data.WTSInfoExLevel1.SessionFlags != WTS_SESSIONSTATE_UNLOCK))
      {
        return STATUS_OFF;
      }
    }
  }

  if (::WTSQuerySessionInformationW(WTS_CURRENT_SERVER_HANDLE, WTS_CURRENT_SESSION, WTSClientProtocolType, &pBuffer, &bytesReturned))
  {
    guard.reset(pBuffer);
    if (bytesReturned >= sizeof(USHORT))
    {
      USHORT protocol = *reinterpret_cast<USHORT *>(static_cast<void *>(pBuffer));
      if (protocol == WTS_PROTOCOL_TYPE_RDP)
        return STATUS_RDP;
      if (protocol == WTS_PROTOCOL_TYPE_CONSOLE)
        return STATUS_CONSOLE;
    }
  }

  return STATUS_UNKNOWN;
}

int Utils::GetIdleSeconds()
{
  LASTINPUTINFO lii = {};
  lii.cbSize = sizeof(LASTINPUTINFO);
  if (::GetLastInputInfo(&lii))
  {
    return static_cast<int>((::GetTickCount() - lii.dwTime) / 1000);
  }
  return 0;
}

std::pair<std::wstring, std::wstring> Utils::GetActiveWindowInfo()
{
  HWND hwnd = ::GetForegroundWindow();
  if (!hwnd)
    return {L"", L""};

  std::wstring windowTitle = L"";
  int length = ::GetWindowTextLengthW(hwnd);
  if (length > 0)
  {
    windowTitle.resize(length);
    ::GetWindowTextW(hwnd, &windowTitle[0], length + 1);
  }

  std::wstring processName = L"";
  DWORD pid = 0;
  ::GetWindowThreadProcessId(hwnd, &pid);
  if (pid != 0)
  {
    bool isUwpHost = false;
    HANDLE hProcess = ::OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
    if (hProcess)
    {
      wchar_t pathBuffer[MAX_PATH];
      DWORD size = MAX_PATH;
      if (::QueryFullProcessImageNameW(hProcess, 0, pathBuffer, &size))
      {
        std::wstring fullPath(pathBuffer);
        size_t lastSlash = fullPath.find_last_of(L"\\/");
        std::wstring exeName = (lastSlash != std::wstring::npos) ? fullPath.substr(lastSlash + 1) : fullPath;
        processName = exeName;
        for (wchar_t &c : exeName)
          c = ::towlower(c);

        if (exeName == L"applicationframehost.exe")
          isUwpHost = true;
      }
      ::CloseHandle(hProcess);
    }

    if (isUwpHost)
    {
      DWORD realPid = pid;
      ::EnumChildWindows(hwnd, EnumUwpChildWindowsProc, static_cast<LPARAM>(reinterpret_cast<UINT_PTR>(&realPid)));

      if (realPid != pid)
      {
        HANDLE hRealProcess = ::OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, realPid);
        if (hRealProcess)
        {
          wchar_t pathBuffer[MAX_PATH];
          DWORD size = MAX_PATH;
          if (::QueryFullProcessImageNameW(hRealProcess, 0, pathBuffer, &size))
          {
            std::wstring fullPath(pathBuffer);
            size_t lastSlash = fullPath.find_last_of(L"\\/");
            processName = (lastSlash != std::wstring::npos) ? fullPath.substr(lastSlash + 1) : fullPath;
          }
          ::CloseHandle(hRealProcess);
        }
      }

      if (processName.empty())
      {
        processName = L"ApplicationFrameHost.exe";
      }
    }
  }

  return {processName, windowTitle};
}

std::string Utils::WideToUtf8(const std::wstring &wstr)
{
  if (wstr.empty())
    return "";
  int size = ::WideCharToMultiByte(CP_UTF8, 0, wstr.c_str(), -1, nullptr, 0, nullptr, nullptr);
  if (size <= 0)
    return "";
  std::string str(size - 1, 0);
  ::WideCharToMultiByte(CP_UTF8, 0, wstr.c_str(), -1, &str[0], size, nullptr, nullptr);
  return str;
}

std::wstring Utils::SanitizeField(const std::wstring &field)
{
  std::wstring result = field;
  for (wchar_t &c : result)
  {
    if (c == L',')
      c = L'.';
    else if (c == L'"')
      c = L'~';
    else if (c == L'\r' || c == L'\n')
      c = L' ';
  }
  return result;
}

bool Utils::EnsureDirectoryExists(const std::wstring &folderPath)
{
  if (folderPath.empty())
    return false;

  DWORD attr = ::GetFileAttributesW(folderPath.c_str());
  if (attr != INVALID_FILE_ATTRIBUTES && (attr & FILE_ATTRIBUTE_DIRECTORY))
    return true;
  
  std::wstring currentPath = L"";
  for (size_t i = 0; i < folderPath.length(); ++i)
  {
    currentPath += folderPath[i];
    if (folderPath[i] == L'\\' || folderPath[i] == L'/' || i == folderPath.length() - 1)
    {
      if (currentPath.empty() || (currentPath.back() == L':' && currentPath.length() <= 3))
      {
        continue;
      }
      DWORD subAttr = ::GetFileAttributesW(currentPath.c_str());
      if (subAttr == INVALID_FILE_ATTRIBUTES)
      {
        if (!::CreateDirectoryW(currentPath.c_str(), NULL) && ::GetLastError() != ERROR_ALREADY_EXISTS)
        {
          return false;
        }
      }
    }
  }
  return true;
}

std::wstring Utils::GetFilePathWithPrefix(const std::wstring &folderPath, const std::wstring &datePrefix)
{
  if (!folderPath.empty() && folderPath.back() != L'\\' && folderPath.back() != L'/')
    return folderPath + L"\\" + datePrefix + L"-" + GetSanitizedUsername() + L".csv";
  else
    return folderPath + datePrefix + L"-" + GetSanitizedUsername() + L".csv";
}

std::wstring Utils::GetSanitizedUsername()
{
  static const std::wstring cachedUsername = []()
  {
    wchar_t buffer[UNLEN + 1] = {0};
    DWORD size = UNLEN + 1;
    if (!::GetUserNameW(buffer, &size) || (--size < 1))
      return std::wstring(L"UNKNOWN");

    Sanitize(buffer, size);
    return std::wstring(buffer, size);
  }();

  return cachedUsername;
}