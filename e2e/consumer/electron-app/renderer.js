/* global TourGuide */
const tour = TourGuide.createTour({ steps: window.demoSteps() });
document.getElementById('opener').addEventListener('click', () => void tour.start());
window.__tour = tour;
window.__ready = true;
