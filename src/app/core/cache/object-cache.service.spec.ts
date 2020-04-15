import * as ngrx from '@ngrx/store';
import { Store } from '@ngrx/store';
import { Operation } from 'fast-json-patch';
import { empty, of as observableOf } from 'rxjs';
import { first, skip, take } from 'rxjs/operators';
import { CoreState } from '../core.reducers';
import { RestRequestMethod } from '../data/rest-request-method';
import { Item } from '../shared/item.model';
import { AddPatchObjectCacheAction, AddToObjectCacheAction, ApplyPatchObjectCacheAction, RemoveFromObjectCacheAction } from './object-cache.actions';
import { Patch } from './object-cache.reducer';
import { ObjectCacheService } from './object-cache.service';
import { AddToSSBAction } from './server-sync-buffer.actions';
import { RemoveFromIndexBySubstringAction } from '../index/index.actions';
import { IndexName } from '../index/index.reducer';
import { HALLink } from '../shared/hal-link.model';
import { getTestScheduler } from 'jasmine-marbles';
import { isNotUndefined } from '../../shared/empty.util';

describe('ObjectCacheService', () => {
  let service: ObjectCacheService;
  let store: Store<CoreState>;
  let linkServiceStub;

  let selfLink;
  let anotherLink;
  let altLink1;
  let altLink2;
  let requestUUID;
  let alternativeLink;
  let timestamp;
  let timestamp2;
  let msToLive;
  let msToLive2
  let objectToCache;
  let cacheEntry;
  let cacheEntry2;
  let invalidCacheEntry;
  let operations;

  function init() {
    selfLink = 'https://rest.api/endpoint/1698f1d3-be98-4c51-9fd8-6bfedcbd59b7';
    anotherLink = 'https://another.link/endpoint/1234';
    altLink1 = 'https://alternative.link/endpoint/1234';
    altLink2 = 'https://alternative.link/endpoint/5678';
    requestUUID = '4d3a4ce8-a375-4b98-859b-39f0a014d736';
    alternativeLink = "https://rest.api/endpoint/5e4f8a5-be98-4c51-9fd8-6bfedcbd59b7/item";
    timestamp = new Date().getTime();
    timestamp2 = new Date().getTime() - 200;
    msToLive = 900000;
    msToLive2 = 120000;
    objectToCache = {
      type: Item.type,
      _links: {
        self: { href: selfLink },
        anotherLink: { href: anotherLink }
      }
    };
    cacheEntry = {
      data: objectToCache,
      timeAdded: timestamp,
      msToLive: msToLive,
      alternativeLinks: [altLink1, altLink2]
    };
    cacheEntry2 = {
      data: objectToCache,
      timeAdded: timestamp2,
      msToLive: msToLive2,
      alternativeLinks: [altLink2]
    };
    invalidCacheEntry = Object.assign({}, cacheEntry, { msToLive: -1 });
    operations = [{ op: 'replace', path: '/name', value: 'random string' } as Operation];
  }

  beforeEach(() => {
    init();
    store = new Store<CoreState>(undefined, undefined, undefined);
    linkServiceStub = {
      removeResolvedLinks: (a) => a
    };
    spyOn(linkServiceStub, 'removeResolvedLinks').and.callThrough();
    spyOn(store, 'dispatch');
    service = new ObjectCacheService(store, linkServiceStub);

    spyOn(Date.prototype, 'getTime').and.callFake(() => {
      return timestamp;
    });
  });

  describe('add', () => {
    it('should dispatch an ADD action with the object to add, the time to live, and the current timestamp', () => {
      service.add(objectToCache, msToLive, requestUUID, alternativeLink);
      expect(store.dispatch).toHaveBeenCalledWith(new AddToObjectCacheAction(objectToCache, timestamp, msToLive, requestUUID, alternativeLink));
      expect(linkServiceStub.removeResolvedLinks).toHaveBeenCalledWith(objectToCache);
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      spyOn(service as any, 'getByHref').and.returnValue(observableOf(cacheEntry));
      spyOn(service as any, 'isValid').and.returnValue(true);
    });

    it('should dispatch a REMOVE action with the self link of the object to remove', () => {
      service.remove(selfLink);
      expect(store.dispatch).toHaveBeenCalledWith(new RemoveFromObjectCacheAction(selfLink));
    });

    it('should dispatch a REMOVE_BY_SUBSTRING action on the index state for each alternativeLink in the object', () => {
      service.remove(selfLink);
      cacheEntry.alternativeLinks.forEach(
        (link: string) => expect(store.dispatch).toHaveBeenCalledWith(new RemoveFromIndexBySubstringAction(IndexName.ALTERNATIVE_OBJECT_LINK, link)))
    });

    it('should dispatch a REMOVE_BY_SUBSTRING action on the index state for each _links in the object, except the self link', () => {
      service.remove(selfLink);
      Object.entries(objectToCache._links).forEach(([key, value]: [string, HALLink]) => {
        if (key !== 'self') {
          expect(store.dispatch).toHaveBeenCalledWith(new RemoveFromIndexBySubstringAction(IndexName.ALTERNATIVE_OBJECT_LINK, value.href))
        }
      });
    });
  });

  describe('getByHref', () => {
    describe('if getBySelfLink emits a valid object and getByAlternativeLink emits undefined', () => {
      beforeEach(() => {
        spyOn(service as any, 'isValid').and.callFake((a) => isNotUndefined(a));
        spyOn(service as any, 'getBySelfLink').and.returnValue(observableOf(cacheEntry));
        spyOn(service as any, 'getByAlternativeLink').and.returnValue(observableOf(undefined));
      });

      it('should return the object emitted by getBySelfLink', () => {
        const result = service.getByHref(selfLink);
        getTestScheduler().expectObservable(result).toBe('(a|)', { a: cacheEntry })
      });
    });

    describe('if getBySelfLink emits an invalid object and getByAlternativeLink emits undefined', () => {
      beforeEach(() => {
        spyOn(service as any, 'isValid').and.returnValue(false);
        spyOn(service as any, 'getBySelfLink').and.returnValue(observableOf(cacheEntry));
        spyOn(service as any, 'getByAlternativeLink').and.returnValue(observableOf(undefined));
      });

      it('should emit nothing', () => {
        const result = service.getByHref(selfLink);
        getTestScheduler().expectObservable(result).toBe('|',)
      });
    });

    describe('if getBySelfLink emits undefined and getByAlternativeLink a valid object', () => {
      beforeEach(() => {
        spyOn(service as any, 'isValid').and.callFake((a) => isNotUndefined(a));
        spyOn(service as any, 'getBySelfLink').and.returnValue(observableOf(undefined));
        spyOn(service as any, 'getByAlternativeLink').and.returnValue(observableOf(cacheEntry));
      });

      it('should return the object emitted by getByAlternativeLink', () => {
        const result = service.getByHref(selfLink);
        getTestScheduler().expectObservable(result).toBe('(a|)', { a: cacheEntry })
      });
    });

    describe('if getBySelfLink emits undefined and getByAlternativeLink emits an invalid object', () => {
      beforeEach(() => {
        spyOn(service as any, 'isValid').and.returnValue(false);
        spyOn(service as any, 'getBySelfLink').and.returnValue(observableOf(undefined));
        spyOn(service as any, 'getByAlternativeLink').and.returnValue(observableOf(cacheEntry));
      });

      it('should emit nothing', () => {
        const result = service.getByHref(selfLink);
        getTestScheduler().expectObservable(result).toBe('|',)
      });
    });

    describe('if getBySelfLink emits a valid and getByAlternativeLink an invalid object', () => {
      beforeEach(() => {
        let counter = 0;
        spyOn(service as any, 'isValid').and.callFake(() => {
          return counter++ === 0;
        });
        spyOn(service as any, 'getBySelfLink').and.returnValue(observableOf(cacheEntry));
        spyOn(service as any, 'getByAlternativeLink').and.returnValue(observableOf(cacheEntry2));
      });

      it('should return the object emitted by getBySelfLink', () => {
        const result = service.getByHref(selfLink);
        getTestScheduler().expectObservable(result).toBe('(a|)', { a: cacheEntry })
      });
    });

    describe('if getBySelfLink emits an invalid and getByAlternativeLink a valid object', () => {
      beforeEach(() => {
        let counter = 0;
        spyOn(service as any, 'isValid').and.callFake(() => {
          return counter++ === 1;
        });
        spyOn(service as any, 'getBySelfLink').and.returnValue(observableOf(cacheEntry));
        spyOn(service as any, 'getByAlternativeLink').and.returnValue(observableOf(cacheEntry2));
      });

      it('should return the object emitted by getByAlternativeLink', () => {
        const result = service.getByHref(selfLink);
        getTestScheduler().expectObservable(result).toBe('(a|)', { a: cacheEntry2 })
      });
    });
  });

  describe('getList', () => {
    it('should return an observable of the array of cached objects with the specified self link and type', () => {
      const item = Object.assign(new Item(), {
        _links: { self: { href: selfLink } }
      });
      spyOn(service, 'getObjectByHref').and.returnValue(observableOf(item));

      service.getList([selfLink, selfLink]).pipe(first()).subscribe((arr) => {
        expect(arr[0]._links.self.href).toBe(selfLink);
        expect(arr[0] instanceof Item).toBeTruthy();
      });
    });
  });

  describe('has', () => {

    describe('getByHref emits an object', () => {
      beforeEach(() => {
        spyOn(service, 'getByHref').and.returnValue(observableOf(cacheEntry))
      });

      it('should return true', () => {
        expect(service.hasByHref(selfLink)).toBe(true);
      });
    });

    describe('getByHref emits nothing', () => {
      beforeEach(() => {
        spyOn(service, 'getByHref').and.returnValue(empty())
      });

      it('should return false', () => {
        expect(service.hasByHref(selfLink)).toBe(false);
      });
    })
  });

  describe('isValid', () => {
    it('should return false if the cacheEntry has expired', () => {
      expect((service as any).isValid(invalidCacheEntry)).toBe(false);
    });

    it('should return true if the cacheEntry has not expired', () => {
      expect((service as any).isValid(cacheEntry)).toBe(true);
    });
  });

  describe('getBySelfLink', () => {
    it('should return the entry returned by the select method', () => {
      spyOnProperty(ngrx, 'select').and.callFake(() => {
        return () => {
          return () => observableOf(cacheEntry);
        };
      });

      getTestScheduler().expectObservable((service as any).getBySelfLink(selfLink)).toBe('(a|)', { a: cacheEntry });
    });
  });

  describe('getByAlternativeLink', () => {
    beforeEach(() => {
      spyOn(service as any, 'getBySelfLink');
    });
    it('should call getBySelfLink with the value returned by the select method', () => {
      spyOnProperty(ngrx, 'select').and.callFake(() => {
        return () => {
          return () => observableOf(anotherLink);
        };
      });
      (service as any).getByAlternativeLink(selfLink).subscribe();
      expect((service as any).getBySelfLink).toHaveBeenCalledWith(anotherLink);
    });
  });

  describe('patch methods', () => {
    it('should dispatch the correct actions when addPatch is called', () => {
      service.addPatch(selfLink, operations);
      expect(store.dispatch).toHaveBeenCalledWith(new AddPatchObjectCacheAction(selfLink, operations));
      expect(store.dispatch).toHaveBeenCalledWith(new AddToSSBAction(selfLink, RestRequestMethod.PATCH));
    });

    it('isDirty should return true when the patches list in the cache entry is not empty', () => {
      cacheEntry.patches = [
        {
          operations: operations
        } as Patch
      ];
      const result = (service as any).isDirty(cacheEntry);
      expect(result).toBe(true);
    });

    it('isDirty should return false when the patches list in the cache entry is empty', () => {
      cacheEntry.patches = [];
      const result = (service as any).isDirty(cacheEntry);
      expect(result).toBe(false);
    });
    it('should dispatch the correct actions when applyPatchesToCachedObject is called', () => {
      (service as any).applyPatchesToCachedObject(selfLink);
      expect(store.dispatch).toHaveBeenCalledWith(new ApplyPatchObjectCacheAction(selfLink));
    });
  });
});
