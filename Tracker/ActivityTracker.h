#pragma once

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <string>
#include <unordered_set>

class ActivityTracker {
public:
  static constexpr LONG STATUS_RUNNING     = 1;
  static constexpr LONG STATUS_PAUSED      = 2;
  static constexpr LONG STATUS_STOPPED     = 3;

  ActivityTracker(const std::wstring& folderPath, int intervalSeconds);

  ~ActivityTracker();

  ActivityTracker(const ActivityTracker&) = delete;
  ActivityTracker& operator=(const ActivityTracker&) = delete;

  void start();
  void stop(DWORD msTimeout);
  void pause();
  void resume();

private:
  void PerformTrackingCycle();
  void CloseFile();
  void Cleanup();
  void PopulateIconCache();
  
  FILE* m_cachedFile = nullptr;
  long m_cachedDayId = 0;

  std::wstring m_folderPath;
  int m_intervalSeconds;
  DWORD m_offSessionCount = 0;
  DWORD m_startWorkTicks = 0;

  // 32-bit atomic state variable aligned for Interlocked execution optimization
  alignas(4) volatile LONG m_status;
  
  HANDLE m_hEvent;
  HANDLE m_hShutdownEvent;
  
  std::unordered_set<std::wstring> m_iconCache;
};
