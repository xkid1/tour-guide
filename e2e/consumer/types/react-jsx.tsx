/** A React app using the adapter in JSX, the way most React users will. */
import * as React from 'react';
import { createReactTourGuide } from '@xkid1/tour-guide/react';
import type { TourStep } from '@xkid1/tour-guide';

const { TourGuide, useTourGuide } = createReactTourGuide(React);

const steps: TourStep[] = [{ id: 'welcome', title: 'Welcome' }];

export function App(): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const tour = useTourGuide();
  return (
    <>
      <button onClick={() => void tour.start()}>Start</button>
      <TourGuide
        ref={tour.ref}
        steps={steps}
        open={open}
        theme="auto"
        onStepChange={(event) => console.log(event.detail.index)}
        onEnd={() => setOpen(false)}
      >
        <div slot="step-welcome">Hi</div>
      </TourGuide>
    </>
  );
}
