/**
 * Installs a happy-dom window as the global environment, like a browser test runner would.
 *
 * Import this FIRST in a test file, before @xkid1/tour-guide. The element picks its base class
 * (HTMLElement, or a placeholder on the server) when the module is evaluated, exactly like it
 * does in a real app, so the DOM has to exist by then.
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator';

if (!GlobalRegistrator.isRegistered) {
  GlobalRegistrator.register({
    url: 'http://localhost:3000/',
    width: 1280,
    height: 800,
  });
}
