import { METRIKA_ID, GOALS, type GoalName } from '../config';
import { getConsent } from './consent';

declare global {
  interface Window { ym?: (...args: unknown[]) => void }
}

/** Страница и услуга, с которой пришло действие: «с какой страницы услуги был звонок». */
function context() {
  const service = document.body.dataset.service;
  return { page: location.pathname, ...(service ? { service } : {}) };
}

export function goal(name: GoalName, params: Record<string, unknown> = {}) {
  const payload = { ...context(), ...params };
  if (METRIKA_ID && window.ym && getConsent() !== 'necessary') {
    window.ym(METRIKA_ID, 'reachGoal', name, payload);
  } else if (import.meta.env.DEV) {
    console.info('[metrika]', name, payload);
  }
}

export { GOALS };
