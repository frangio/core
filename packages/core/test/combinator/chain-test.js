import { describe, it } from 'mocha'
import { assert, eq } from '@briancavalier/assert'
import { spy } from 'sinon'

import { chain, join } from '../../src/combinator/chain'
import { delay } from '../../src/combinator/delay'
import { concat } from '../../src/combinator/build'
import { take } from '../../src/combinator/slice'
import { drain } from '../helper/observe'
import { just, never } from '../../src/source/core'

import { assertSame } from '../helper/stream-helper'
import { collectEventsFor, makeEventsFromArray } from '../helper/testEnv'
import FakeDisposeStream from '../helper/FakeDisposeStream'

const sentinel = { value: 'sentinel' }

describe('chain', function () {
  it('should satisfy associativity', function () {
    // m.chain(f).chain(g) ~= m.chain(function(x) { return f(x).chain(g); })
    const f = x => just(x + 'f')
    const g = x => just(x + 'g')

    const m = just('m')

    return assertSame(
      chain(x => chain(g, f(x)), m),
      chain(g, chain(f, m))
    )
  })

  it('should preserve time order', function () {
    const s = chain(x => delay(x, just(x)), makeEventsFromArray(0, [2, 1]))
    const expected = [ { time: 1, value: 1 }, { time: 2, value: 2 } ]

    return collectEventsFor(3, s)
      .then(eq(expected))
  })
})

describe('join', function () {
  it('should merge items from all inner streams', function () {
    const a = [1, 2, 3]
    const b = [4, 5, 6]
    const streamsToMerge = makeEventsFromArray(1, [makeEventsFromArray(2, b), makeEventsFromArray(2, a)])

    const s = join(streamsToMerge)

    return collectEventsFor(5, s)
      .then(eq([
        { time: 0, value: 4 },
        { time: 1, value: 1 },
        { time: 2, value: 5 },
        { time: 3, value: 2 },
        { time: 4, value: 6 },
        { time: 5, value: 3 }
      ]))
  })

  it('should dispose outer stream', function () {
    const dispose = spy()
    const inner = just(sentinel)
    const outer = just(inner)

    const s = join(new FakeDisposeStream(dispose, outer))

    return drain(s).then(() => assert(dispose.calledOnce))
  })

  it('should dispose inner stream', function () {
    const dispose = spy()
    const inner = new FakeDisposeStream(dispose, just(sentinel))

    const s = join(just(inner))

    return drain(s).then(() => assert(dispose.calledOnce))
  })

  it('should dispose inner stream immediately', function () {
    const s = just(concat(just(1), never()))
    return drain(take(1, join(s))).then(() => assert(true))
  })

  it('should dispose all inner streams', function () {
    const values = [1, 2, 3]
    const spies = values.map(() => spy())

    const inners = values.map((x, i) => new FakeDisposeStream(spies[i], just(x)))

    const s = join(makeEventsFromArray(1, inners))

    return collectEventsFor(3, s)
      .then(() =>
        spies.forEach(spy => assert(spy.calledOnce)))
  })
})
