import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { BehaviorSubject, Observable } from 'rxjs';
import { first, map, take } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';

import { ResourcePolicyService } from '../../../core/resource-policy/resource-policy.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { RemoteData } from '../../../core/data/remote-data';
import { ResourcePolicy } from '../../../core/resource-policy/models/resource-policy.model';
import { ResourcePolicyEvent } from '../form/resource-policy-form';
import { ITEM_EDIT_AUTHORIZATIONS_PATH } from '../../../+item-page/edit-item-page/edit-item-page.routing.module';
import { RESOURCE_POLICY } from '../../../core/resource-policy/models/resource-policy.resource-type';

@Component({
  selector: 'ds-resource-policy-edit',
  templateUrl: './resource-policy-edit.component.html'
})
export class ResourcePolicyEditComponent implements OnInit {

  /**
   * The resource policy object to edit
   */
  public resourcePolicy: ResourcePolicy;

  /**
   * A boolean representing if a submission editing operation is pending
   * @type {BehaviorSubject<boolean>}
   */
  private processing$ = new BehaviorSubject<boolean>(false);

  constructor(
    private notificationsService: NotificationsService,
    private resourcePolicyService: ResourcePolicyService,
    private route: ActivatedRoute,
    private router: Router,
    private translate: TranslateService) {
  }

  ngOnInit(): void {
    this.route.data.pipe(
      map((data) => data),
      take(1)
    ).subscribe((data: any) => {
      this.resourcePolicy = (data.resourcePolicy as RemoteData<ResourcePolicy>).payload;
    });
  }

  isProcessing(): Observable<boolean> {
    return this.processing$.asObservable();
  }

  redirectToAuthorizationsPage() {
    this.router.navigate([`../../${ITEM_EDIT_AUTHORIZATIONS_PATH}`], { relativeTo: this.route });
  }

  updateResourcePolicy(event: ResourcePolicyEvent) {
    this.processing$.next(true);
    const updatedObject = Object.assign({}, event.object, {
      id: this.resourcePolicy.id,
      type: RESOURCE_POLICY.value,
      _links: this.resourcePolicy._links
    });
    this.resourcePolicyService.update(updatedObject).pipe(
      first((response: RemoteData<ResourcePolicy>) => !response.isResponsePending)
    ).subscribe((responseRD: RemoteData<ResourcePolicy>) => {
      this.processing$.next(false);
      if (responseRD.hasSucceeded) {
        this.notificationsService.success(null, this.translate.get('resource-policies.edit.page.success.content'));
        this.redirectToAuthorizationsPage();
      } else {
        this.notificationsService.error(null, this.translate.get('resource-policies.edit.page.failure.content'));
      }
    })
  }
}