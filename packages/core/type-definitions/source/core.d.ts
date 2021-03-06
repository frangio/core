import { Stream } from '@most/types';

export function just<A>(a: A): Stream<A>;
export function empty(): Stream<any>;
export function never(): Stream<any>;
