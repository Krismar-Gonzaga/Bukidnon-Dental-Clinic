// Full-page navigation, matching the app's current path-based page switch
// in App.js. Kept in one place so it can be swapped for a router later.
export function navigateTo(href) {
  window.location.assign(href);
}
