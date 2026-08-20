#include "ActivityTracker.h"
#include "Utils.h"
#include <utility>
#include <cstdio>

ActivityTracker::ActivityTracker(const std::wstring &folderPath, int intervalSeconds)
    : m_folderPath(folderPath), m_intervalSeconds(intervalSeconds), m_status(STATUS_RUNNING), m_hEvent(nullptr), m_hShutdownEvent(nullptr)
{
  m_hEvent = CreateEventW(nullptr, FALSE, TRUE, nullptr);
  m_hShutdownEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);
}

ActivityTracker::~ActivityTracker()
{
  Cleanup();
}

void ActivityTracker::Cleanup()
{
  CloseFile();

  if (m_hEvent != nullptr)
    CloseHandle(m_hEvent);
  m_hEvent = nullptr;

  if (m_hShutdownEvent != nullptr)
    CloseHandle(m_hShutdownEvent);
  m_hShutdownEvent = nullptr;
}

void ActivityTracker::PopulateIconCache()
{
  m_iconCache.clear();
  std::wstring iconsFolder = m_folderPath + L"\\icons";
  Utils::EnsureDirectoryExists(iconsFolder);

  std::wstring searchPath = iconsFolder + L"\\*.png";
  WIN32_FIND_DATAW findData;
  HANDLE hFind = ::FindFirstFileW(searchPath.c_str(), &findData);

  if (hFind != INVALID_HANDLE_VALUE)
  {
    do
    {
      if (!(findData.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY))
      {
        std::wstring filename(findData.cFileName);
        size_t lastDot = filename.find_last_of(L'.');
        if (lastDot != std::wstring::npos)
        {
          m_iconCache.insert(filename.substr(0, lastDot));
        }
      }
    } while (::FindNextFileW(hFind, &findData));
    ::FindClose(hFind);
  }
}

void ActivityTracker::CloseFile()
{
  if (m_cachedFile != nullptr)
    ::fclose(m_cachedFile);
  m_cachedFile = nullptr;
}

void ActivityTracker::start()
{
  PopulateIconCache();
  
  while (InterlockedCompareExchange(&m_status, 0, 0) != STATUS_STOPPED)
  {
    DWORD interval = m_intervalSeconds * 1000;
    DWORD worktick = (GetTickCount() - m_startWorkTicks);
    interval = worktick > interval ? 0 : interval - worktick;
    WaitForSingleObject(m_hEvent, interval);

    LONG currentStatus = InterlockedCompareExchange(&m_status, 0, 0);

    if (currentStatus == STATUS_PAUSED)
    {
      CloseFile();
      m_cachedDayId = 0;
      WaitForSingleObject(m_hEvent, INFINITE);
    }
    else if (currentStatus == STATUS_RUNNING)
    {
      m_startWorkTicks = GetTickCount();
      PerformTrackingCycle();
    }
  }

  SetEvent(m_hShutdownEvent);
}

void ActivityTracker::stop(DWORD msTimeout)
{
  InterlockedExchange(&m_status, STATUS_STOPPED);
  SetEvent(m_hEvent);

  if (m_hShutdownEvent)
  {
    if (WaitForSingleObject(m_hShutdownEvent, msTimeout) == WAIT_OBJECT_0)
      Cleanup();
  }
}

void ActivityTracker::pause()
{
  InterlockedCompareExchange(&m_status, STATUS_PAUSED, STATUS_RUNNING);
  SetEvent(m_hEvent);
}

void ActivityTracker::resume()
{
  InterlockedCompareExchange(&m_status, STATUS_RUNNING, STATUS_PAUSED);
  SetEvent(m_hEvent);
}

namespace
{
  inline void itow_back(DWORD value, wchar_t *last, unsigned int count)
  {
    while (count-- > 0 && value > 0)
    {
      *last = L'0' + (value % 10);
      value /= 10;
      --last;
    }
  }

  inline long GetDayId(const SYSTEMTIME &st)
  {
    return st.wMonth * 32 + st.wDay;
  }
}

void ActivityTracker::PerformTrackingCycle()
{
  std::wstring session = Utils::GetConnectionStatus();
  m_offSessionCount = (session == L"off") ? (m_offSessionCount + 1) : 0;

  if (m_offSessionCount > 2)
  {
    CloseFile();
    return;
  }

  SYSTEMTIME st;
  ::GetLocalTime(&st);

  int secondsSinceMidnight = (st.wHour * 3600) + (st.wMinute * 60) + st.wSecond;

  wchar_t dateBuf[] = {L'0', L'0', L'0', L'0', L'-', L'0', L'0', L'-', L'0', L'0', L'\0'};
  itow_back(st.wDay, dateBuf + 9, 2);
  itow_back(st.wMonth, dateBuf + 6, 2);
  itow_back(st.wYear, dateBuf + 3, 4);
  std::wstring wDateStr(dateBuf, 10);

  long currentDayId = GetDayId(st);
  if (currentDayId != m_cachedDayId || m_cachedFile == nullptr)
  {
    CloseFile();

    Utils::EnsureDirectoryExists(m_folderPath);
    std::wstring filePath = Utils::GetFilePathWithPrefix(m_folderPath, wDateStr);

    m_cachedFile = ::_wfsopen(filePath.c_str(), L"ab", _SH_DENYNO);
    if (m_cachedFile != nullptr)
      m_cachedDayId = currentDayId;
  }

  int idleSeconds = Utils::GetIdleSeconds();

  std::wstring wProcName = L"";
  std::wstring wTitle = L"";

  if (m_offSessionCount == 0)
  {
    std::pair<std::wstring, std::wstring> winInfo = Utils::GetActiveWindowInfo();
    std::wstring fullPath = winInfo.first;
    wTitle = Utils::SanitizeField(winInfo.second);

    if (!fullPath.empty())
    {
      size_t lastSlash = fullPath.find_last_of(L"\\/");
      std::wstring exeName = (lastSlash != std::wstring::npos) ? fullPath.substr(lastSlash + 1) : fullPath;

      for (wchar_t &c : exeName)
        c = ::towlower(c);

      wProcName = Utils::SanitizeField(exeName);

      if (m_iconCache.find(exeName) == m_iconCache.end())
      {
        std::wstring targetIconPath = m_folderPath + L"\\icons\\" + exeName + L".png";

        if (Utils::ExtractAndSaveIcon(fullPath, targetIconPath))
        {
          m_iconCache.insert(exeName);
        }
      }
    }
  }

  std::wstring wLine;
  wLine.reserve(256 + wProcName.length() + wTitle.length());

  wLine.append(dateBuf, 10);
  wLine.push_back(L',');

  wchar_t timeBuf[] = {L'0', L'0', L':', L'0', L'0', L':', L'0', L'0', L'.', L'0', L'0', L'0', L'\0'};
  itow_back(st.wMilliseconds, timeBuf + 11, 3);
  itow_back(st.wSecond, timeBuf + 7, 2);
  itow_back(st.wMinute, timeBuf + 4, 2);
  itow_back(st.wHour, timeBuf + 1, 2);
  wLine.append(timeBuf, 12);
  wLine.push_back(L',');

  wLine.append(std::to_wstring(secondsSinceMidnight));
  wLine.push_back(L',');
  wLine.append(session);
  wLine.push_back(L',');
  wLine.append(std::to_wstring(idleSeconds));
  wLine.push_back(L',');
  wLine.append(wProcName);
  wLine.push_back(L',');
  wLine.append(wTitle);
  wLine.push_back(L'\n');

  std::string csvLineUtf8 = Utils::WideToUtf8(wLine);

  if (m_cachedFile != nullptr)
  {
    ::fwrite(csvLineUtf8.c_str(), sizeof(char), csvLineUtf8.size(), m_cachedFile);
    ::fflush(m_cachedFile);
  }
}
