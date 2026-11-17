import { createTour } from '@xkid1/tour-guide/browser';

await import('/browser/steps.js');
const tour = createTour({ steps: window.demoSteps() });
document.getElementById('opener').addEventListener('click', () => void tour.start());
window.__tour = tour;
window.__violations = [];
window.__ready = true;
