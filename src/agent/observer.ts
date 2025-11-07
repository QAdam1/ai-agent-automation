import { Observation, ObservationDelta } from './types.js';

export class AgentObserver {
  private lastObservation: Observation | null = null;

  async capture(): Promise<{ observation: Observation; delta: ObservationDelta }> {
    const url = await browser.getUrl();
    const title = await browser.getTitle();
    const snapshot = await browser.execute(() => {
      const textEntries: string[] = [];
      const interactiveEntries: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      while (walker.nextNode() && textEntries.length < 40) {
        const element = walker.currentNode as HTMLElement;
        if (!element || element.offsetParent === null) {
          continue;
        }
        const label = element.innerText?.trim();
        if (label) {
          textEntries.push(label.replace(/\s+/g, ' '));
        }
        if (['A', 'BUTTON'].includes(element.tagName)) {
          interactiveEntries.push(element.innerText.trim() || element.getAttribute('href') || '');
        }
        const role = element.getAttribute('role');
        if (role && ['button', 'link', 'menuitem'].includes(role) && interactiveEntries.length < 40) {
          interactiveEntries.push(element.innerText.trim());
        }
      }

      const toast = document.querySelector('[role="alert"], .toast, .notification');

      return {
        texts: Array.from(new Set(textEntries)).slice(0, 20),
        interactive: Array.from(new Set(interactiveEntries)).slice(0, 20),
        toast: toast?.textContent?.trim() ?? null,
      };
    });

    const observation: Observation = {
      url,
      title,
      visibleTexts: snapshot.texts,
      interactiveElements: snapshot.interactive,
      lastToast: snapshot.toast,
    };

    const delta = this.computeDelta(observation);
    this.lastObservation = observation;
    return { observation, delta };
  }

  private computeDelta(observation: Observation): ObservationDelta {
    if (!this.lastObservation) {
      return {
        urlChanged: true,
        titleChanged: true,
        url: observation.url,
        title: observation.title,
        addedTexts: observation.visibleTexts,
        removedTexts: [],
        interactiveElements: observation.interactiveElements,
        lastToast: observation.lastToast ?? null,
      };
    }

    const previous = this.lastObservation;
    const addedTexts = observation.visibleTexts.filter((entry) => !previous.visibleTexts.includes(entry));
    const removedTexts = previous.visibleTexts.filter((entry) => !observation.visibleTexts.includes(entry));

    return {
      urlChanged: previous.url !== observation.url,
      titleChanged: previous.title !== observation.title,
      url: observation.url,
      title: observation.title,
      addedTexts,
      removedTexts,
      interactiveElements: observation.interactiveElements,
      lastToast: observation.lastToast ?? null,
    };
  }
}
