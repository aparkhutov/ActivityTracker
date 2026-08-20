#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <lmcons.h>
#include <shellapi.h>
#include <string>
#include <vector>
#include <thread>
#include <cwctype>

#include "resources.h"
#include "Utils.h"
#include "ActivityTracker.h"

// Custom window message definitions
#define WM_TRAYICON (WM_USER + 1)
#define ID_TRAY_CLOSE 1001

// Global pointers for state management and WndProc accessibility
ActivityTracker *g_tracker = nullptr;
std::thread *g_worker = nullptr;
UINT g_msgTaskbarCreated = 0;
NOTIFYICONDATAW g_nid = {};

// Inline helper wrappers for clean lifetime tracking and sync
namespace
{
  inline void tracker_pause()
  {
    if (g_tracker != nullptr)
      g_tracker->pause();
  }
  inline void tracker_resume()
  {
    if (g_tracker != nullptr)
      g_tracker->resume();
  }
  inline void tracker_stop(DWORD ms)
  {
    if (g_tracker != nullptr)
      g_tracker->stop(ms);
  }
  inline void worker_join(bool wait)
  {
    if (g_worker != nullptr && g_worker->joinable())
    {
      if (wait)
        g_worker->join();
      else
        g_worker->detach();
    }
  }

  inline void InitializeTrayIcon(HWND hWnd, HINSTANCE hInstance)
  {
    g_nid.cbSize = sizeof(NOTIFYICONDATAW);
    g_nid.hWnd = hWnd;
    g_nid.uID = 1;
    g_nid.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP;
    g_nid.uCallbackMessage = WM_TRAYICON;
    g_nid.hIcon = LoadIconW(hInstance, MAKEINTRESOURCEW(IDI_ICON));
    wcsncpy_s(g_nid.szTip, L"Activity Tracker", _countof(g_nid.szTip));

    Shell_NotifyIconW(NIM_ADD, &g_nid);
  }

  std::wstring GetDefaultFolderPath()
  {
    wchar_t localAppData[MAX_PATH] = {0};
    DWORD ret = GetEnvironmentVariableW(L"LOCALAPPDATA", localAppData, MAX_PATH);
    if (ret > 0 && ret < MAX_PATH)
    {
      return std::wstring(localAppData) + L"\\ActivityTracker";
    }
    else
    {
      DWORD tempRet = GetTempPathW(MAX_PATH, localAppData);
      if (tempRet > 0 && tempRet < MAX_PATH)
        return std::wstring(localAppData) + L"ActivityTracker";
      else
        return L".\\ActivityTracker";
    }
  }
}

// RAII wrapper class for application single-instance locking
class InstanceLock
{
public:
  explicit InstanceLock(const std::wstring &filePath) : hFile(INVALID_HANDLE_VALUE)
  {
    hFile = CreateFileW(filePath.c_str(),
                        GENERIC_READ | GENERIC_WRITE, 0, nullptr,
                        OPEN_ALWAYS, FILE_FLAG_DELETE_ON_CLOSE, nullptr);
  }

  ~InstanceLock()
  {
    if (hFile != INVALID_HANDLE_VALUE)
      CloseHandle(hFile);
  }
  InstanceLock(const InstanceLock &) = delete;
  InstanceLock &operator=(const InstanceLock &) = delete;
  explicit operator bool() const { return hFile != INVALID_HANDLE_VALUE; }

private:
  HANDLE hFile;
};

// Forward declaration of window procedure
LRESULT CALLBACK WndProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam);

// Isolated command line argument parsing with automatic cleanup
void ParseCommandLineArguments(std::wstring &folderPath, int &intervalSeconds)
{
  int argc = 0;
  LPWSTR *argv = CommandLineToArgvW(GetCommandLineW(), &argc);
  if (!argv)
    return;
  constexpr size_t folderLen = _countof(L"--folder=") - 1;
  constexpr size_t intervalLen = _countof(L"--interval=") - 1;
  for (LPWSTR *p = argv + 1; (*p) != nullptr; ++p)
  {
    if (std::wcsncmp(*p, L"--folder=", folderLen) == 0)
    {
      folderPath = (*p) + folderLen;
    }
    else if (std::wcsncmp(*p, L"--interval=", intervalLen) == 0)
    {
      wchar_t *endptr = nullptr;
      long val = std::wcstol((*p) + intervalLen, &endptr, 10);
      if (endptr != (*p) + intervalLen && val >= 1 && val <= 600)
      {
        intervalSeconds = static_cast<int>(val);
      }
    }
  }
  LocalFree(argv);
}

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow)
{
  (void)hPrevInstance;
  (void)lpCmdLine;
  (void)nCmdShow;

  // 1. Command Line Parsing via standard Win32 APIs
  std::wstring folderPath = L"";
  int intervalSeconds = 10;
  ParseCommandLineArguments(folderPath, intervalSeconds);

  // Fallback to default folder path if not provided
  if (folderPath.empty())
    folderPath = GetDefaultFolderPath();

  // 2. Ensure folder path exists
  CreateDirectoryW(folderPath.c_str(), nullptr);

  // 3. Single Instance Lock File Mechanism (RAII)
  std::wstring lockFileName = folderPath + L"\\ActivityTracker_" + Utils::GetSanitizedUsername() + L".lock";
  InstanceLock appLock(lockFileName);

  if (!appLock)
  {
    OutputDebugStringW(L"Another instance is already running or lock file is inaccessible. Exiting.");
    return 0;
  }

  // 4. Register application restart payload for Windows recovery
  RegisterApplicationRestart(GetCommandLineW(), 0);

  // 5. Background Hidden Window Registration & Creation
  const wchar_t CLASS_NAME[] = L"ActivityTrackerWindowClass";

  WNDCLASSEXW wc = {};
  wc.cbSize = sizeof(WNDCLASSEXW);
  wc.lpfnWndProc = WndProc;
  wc.hInstance = hInstance;
  wc.lpszClassName = CLASS_NAME;

  if (!RegisterClassExW(&wc))
    return 0;

  HWND hWnd = CreateWindowExW(0, CLASS_NAME, L"", 0, 0, 0, 0, 0, nullptr, nullptr, hInstance, nullptr);

  if (!hWnd)
    return 0;

  // 6. Taskbar Restoration Message Registration
  g_msgTaskbarCreated = RegisterWindowMessageW(L"TaskbarCreated");

  // 7. System Tray Icon Setup
  InitializeTrayIcon(hWnd, hInstance);

  // 8. Instantiation and Worker Thread Lifecycle Management
  ActivityTracker tracker(folderPath, intervalSeconds);
  g_tracker = &tracker;

  std::thread worker(&ActivityTracker::start, &tracker);
  g_worker = &worker;

  // 9. Standard Pure Win32 Non-blocking Message Loop
  MSG msg = {};
  while (GetMessageW(&msg, nullptr, 0, 0))
  {
    TranslateMessage(&msg);
    DispatchMessageW(&msg);
  }

  // 10. Strict and Safe Teardown Sequence (CRITICAL)
  tracker_stop(INFINITE);
  worker_join(true);

  Shell_NotifyIconW(NIM_DELETE, &g_nid);
  return (int)msg.wParam;
}

// Window Procedure implementing clean routing matching all architectural criteria
LRESULT CALLBACK WndProc(HWND hWnd, UINT message, WPARAM wParam, LPARAM lParam)
{
  if (message == g_msgTaskbarCreated)
  {
    Shell_NotifyIconW(NIM_ADD, &g_nid);
    return 0;
  }

  switch (message)
  {
  case WM_TRAYICON:
  {
    if (lParam == WM_RBUTTONUP)
    {
      if (HMENU hMenu = CreatePopupMenu())
      {
        AppendMenuW(hMenu, MF_STRING, ID_TRAY_CLOSE, L"Close");
        POINT pt;
        GetCursorPos(&pt);
        SetForegroundWindow(hWnd);
        TrackPopupMenu(hMenu, TPM_BOTTOMALIGN | TPM_LEFTALIGN, pt.x, pt.y, 0, hWnd, nullptr);
        PostMessageW(hWnd, WM_NULL, 0, 0);
        DestroyMenu(hMenu);
      }
    }
    return 0;
  }

  case WM_COMMAND:
  {
    if (LOWORD(wParam) == ID_TRAY_CLOSE)
    {
      DestroyWindow(hWnd);
    }
    return 0;
  }

  case WM_QUERYENDSESSION:
  {
    tracker_pause();
    return TRUE;
  }

  case WM_ENDSESSION:
  {
    if (static_cast<BOOL>(wParam) == TRUE)
    {
      tracker_stop(2500);
      worker_join(false);
    }
    else
    {
      tracker_resume();
    }
    return 0;
  }

  case WM_POWERBROADCAST:
  {
    if (wParam == PBT_APMSUSPEND)
    {
      tracker_pause();
    }
    else if (wParam == PBT_APMRESUMEAUTOMATIC)
    {
      tracker_resume();
    }
    return TRUE;
  }

  case WM_DESTROY:
  {
    PostQuitMessage(0);
    return 0;
  }

  default:
    return DefWindowProcW(hWnd, message, wParam, lParam);
  }
}
