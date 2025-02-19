// Copyright 2017-2023 @polkadot/api-derive authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Observable } from 'rxjs';
import type { Option } from '@polkadot/types';
import type { AccountId } from '@polkadot/types/interfaces';
import type { KitchensinkRuntimeSessionKeys } from '@polkadot/types/lookup';
import type { DeriveApi } from '../types';
import type { DeriveStakingKeys } from './types';

import { combineLatest, map, of, switchMap } from 'rxjs';

import { firstMemo, memo } from '../util';

function extractsIds (stashId: Uint8Array | string, queuedKeys: [AccountId, KitchensinkRuntimeSessionKeys | AccountId[]][], nextKeys: Option<KitchensinkRuntimeSessionKeys>): DeriveStakingKeys {
  const sessionIds = (queuedKeys.find(([currentId]) => currentId.eq(stashId)) || [undefined, [] as AccountId[]])[1];
  const nextSessionIds = nextKeys.unwrapOr([] as AccountId[]);

  return {
    nextSessionIds: Array.isArray(nextSessionIds)
      ? nextSessionIds
      : [...nextSessionIds.values()] as AccountId[],
    sessionIds: Array.isArray(sessionIds)
      ? sessionIds
      : [...sessionIds.values()] as AccountId[]
  };
}

export const keys = firstMemo(
  (api: DeriveApi, stashId: Uint8Array | string) =>
    api.derive.staking.keysMulti([stashId])
);

export function keysMulti (instanceId: string, api: DeriveApi): (stashIds: (Uint8Array | string)[]) => Observable<DeriveStakingKeys[]> {
  return memo(instanceId, (stashIds: (Uint8Array | string)[]): Observable<DeriveStakingKeys[]> =>
    stashIds.length
      ? api.query.session.queuedKeys().pipe(
        switchMap((queuedKeys) =>
          combineLatest([
            of(queuedKeys),
            api.consts.session?.dedupKeyPrefix
              ? api.query.session.nextKeys.multi(stashIds.map((s) => [api.consts.session.dedupKeyPrefix, s]))
              : combineLatest(stashIds.map((s) => api.query.session.nextKeys(s)))
          ])
        ),
        map(([queuedKeys, nextKeys]) =>
          stashIds.map((stashId, index) =>
            extractsIds(stashId, queuedKeys, nextKeys[index])
          )
        )
      )
      : of([])
  );
}
