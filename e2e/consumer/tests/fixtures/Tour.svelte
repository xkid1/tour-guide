<script>
  // Works in Svelte 4 and 5 (no runes), like most published Svelte apps.
  import { createSvelteTourGuide, tourGuide } from '@xkid1/tour-guide/svelte';

  export let steps = [];
  export let open = false;
  export let events = [];
  export let controls = createSvelteTourGuide();

  const log = (type) => (event) => {
    events.push({ type, detail: event.detail });
  };
</script>

<button id="start" on:click={() => controls.start()}>Take the tour</button>
<button id="toggle" on:click={() => (open = !open)}>Toggle</button>

<tour-guide
  id="action-tour"
  use:tourGuide={{
    steps,
    open,
    theme: 'dark',
    onStart: log('start'),
    onStepChange: log('step-change'),
    onEnd: (event) => {
      log('end')(event);
      open = false;
    },
  }}
>
  <div slot="step-welcome" class="svelte-slot">Projected <b>Svelte</b> markup</div>
</tour-guide>

<tour-guide id="controls-tour" use:controls.tourGuide={{ steps }}></tour-guide>
