/* global TourGuide */
window.__violations = [];
document.addEventListener('securitypolicyviolation', (event) => {
  window.__violations.push(`${event.violatedDirective}: ${event.blockedURI}`);
});
const script = document.createElement('script');
script.src = '/browser/steps.js';
script.onload = () => {
  const tour = TourGuide.createTour({ steps: window.demoSteps() });
  document.getElementById('opener').addEventListener('click', () => void tour.start());
  window.__tour = tour;
  window.__ready = true;
};
document.head.append(script);
