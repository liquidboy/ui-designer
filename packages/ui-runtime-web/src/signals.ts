import { useMemo } from 'preact/hooks';
import { useSignal, type Signal } from '@preact/signals';

export {
  Signal,
  batch,
  computed,
  effect,
  signal,
  untracked,
  useComputed,
  useSignal,
  useSignalEffect,
  type ReadonlySignal
} from '@preact/signals';

export type SignalStateInitializer<T> = T | (() => T);
export type SignalStateUpdate<T> = T | ((current: T) => T);
export type SignalStateSetter<T> = (update: SignalStateUpdate<T>) => void;
export type SignalStateTuple<T> = readonly [value: T, setValue: SignalStateSetter<T>, signal: Signal<T>];

function resolveSignalStateInitialValue<T>(initialValue: SignalStateInitializer<T>): T {
  return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
}

export function setSignalValue<T>(target: Signal<T>, update: SignalStateUpdate<T>): void {
  target.value = typeof update === 'function' ? (update as (current: T) => T)(target.peek()) : update;
}

export function useSignalState<T>(initialValue: SignalStateInitializer<T>): SignalStateTuple<T>;
export function useSignalState<T = undefined>(): SignalStateTuple<T | undefined>;
export function useSignalState<T>(initialValue?: SignalStateInitializer<T>): SignalStateTuple<T | undefined> {
  const hasInitialValue = arguments.length > 0;
  const resolvedInitialValue = useMemo(
    () => (hasInitialValue ? resolveSignalStateInitialValue(initialValue as SignalStateInitializer<T>) : undefined),
    []
  );
  const state = useSignal<T | undefined>(resolvedInitialValue);
  const setState = useMemo<SignalStateSetter<T | undefined>>(() => (update) => setSignalValue(state, update), [state]);

  return [state.value, setState, state];
}
