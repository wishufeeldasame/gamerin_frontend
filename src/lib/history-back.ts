type NavigationLike = { canGoBack?: unknown };

// 앱 안 뒤로 버튼이 돌아갈 이전 항목이 있는지. history.length는 앞으로 갈 항목까지 세서 쓰지 않는다.
// shortcut: Navigation API가 없는 브라우저는 history.length로 판단해, 앞으로 갈 기록만 있으면 뒤로가기가 아무 동작도 하지 않는다. 지원 브라우저가 넓어지면 이 분기를 지운다.
export function canGoBack(): boolean {
  const navigation = (window as Window & { navigation?: NavigationLike }).navigation;
  if (typeof navigation?.canGoBack === 'boolean') return navigation.canGoBack;
  return window.history.length > 1;
}
