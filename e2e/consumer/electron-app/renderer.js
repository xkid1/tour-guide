/* global TourGuide */
window.__violations = [];
document.addEventListener('securitypolicyviolation', (event) => {
  window.__violations.push(`${event.violatedDirective}: ${event.blockedURI}`);
});

const tour = TourGuide.createTour({ steps: window.demoSteps() });
document.getElementById('opener').addEventListener('click', () => void tour.start());
window.__tour = tour;
window.__ready = true;
