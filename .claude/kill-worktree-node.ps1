# SessionEnd hook: kill any node processes running out of .claude\worktrees
# (orphaned Expo/Metro dev servers from Claude Code worktree sessions)
Get-CimInstance Win32_Process -Filter "name='node.exe'" |
    Where-Object { $_.CommandLine -like '*\.claude\worktrees\*' } |
    ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
