/**
 * Angular adapter (v15+, standalone or NgModule). No @angular/* imports — zero dependency.
 *
 * 1. Register the element once:
 *      bootstrapApplication(App, { providers: [provideAppInitializer(registerTourGuide)] });
 *    (or simply call `registerTourGuide()` in main.ts)
 * 2. Add `schemas: [CUSTOM_ELEMENTS_SCHEMA]` to the component/module that uses `<tour-guide>`.
 * 3. Bind properties and events directly:
 *      <tour-guide #tour [steps]="steps" [options]="options" (tour-complete)="done($event)"></tour-guide>
 * 4. Optionally wrap it for an RxJS-free, typed controller:
 *      @ViewChild('tour') tourRef!: ElementRef<TourGuideElement>;
 *      ngAfterViewInit() { this.tour = new TourGuideController(this.tourRef.nativeElement); }
 */
import { DEFAULT_TAG_NAME, defineTourGuide } from '@libs';
import type { TourGuideElement } from '@libs';
import type { TourEventMap, TourEventName, TourOptions, TourStep } from '@types';

/** Registers `<tour-guide>`; usable directly as an Angular app initializer. */
export function registerTourGuide(tagName: string = DEFAULT_TAG_NAME): void {
  defineTourGuide(tagName);
}

/** Thin typed wrapper around an element; call `destroy()` in `ngOnDestroy`. */
export class TourGuideController {
  readonly element: TourGuideElement;
  readonly #offs: (() => void)[] = [];

  constructor(element: TourGuideElement) {
    this.element = element;
  }

  setSteps(steps: TourStep[]): this {
    this.element.steps = steps;
    return this;
  }

  setOptions(options: TourOptions): this {
    this.element.options = options;
    return this;
  }

  on<K extends TourEventName>(
    type: K,
    listener: (detail: TourEventMap[K], event: CustomEvent<TourEventMap[K]>) => void,
  ): this {
    this.#offs.push(
      this.element.on(type, (event) => {
        listener(event.detail, event);
      }),
    );
    return this;
  }

  start(index?: number): Promise<boolean> {
    return this.element.start(index);
  }
  next(): Promise<boolean> {
    return this.element.next();
  }
  back(): Promise<boolean> {
    return this.element.back();
  }
  goTo(index: number): Promise<boolean> {
    return this.element.goTo(index);
  }
  skip(): boolean {
    return this.element.skip();
  }
  complete(): boolean {
    return this.element.complete();
  }
  close(): boolean {
    return this.element.close();
  }

  destroy(): void {
    this.element.close();
    this.#offs.splice(0).forEach((off) => {
      off();
    });
  }
}

export type { TourGuideElement };
