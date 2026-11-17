// Shared by both pages. A classic script, so it also works next to the IIFE.
window.demoSteps = function demoSteps() {
  return [
    { id: 'welcome', title: 'Welcome', content: 'Hello from the tour' },
    {
      id: 'anchor',
      target: '#anchor',
      placement: 'bottom',
      title: 'Anchored',
      content: 'Here',
    },
    { id: 'far', target: '#far', placement: 'top', title: 'Far', content: 'Scrolled to' },
  ];
};
