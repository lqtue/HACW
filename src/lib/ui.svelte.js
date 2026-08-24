// Cross-component UI flag: the home route drives its own screens via local state
// the layout can't see, so it sets `hideNav` when a screen wants the tab bar gone
// (the manual builder + the plan-ready screen). Reset on leaving the route.
export const ui = $state({ hideNav: false, hideTheme: false });
