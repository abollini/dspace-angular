import { ChangeDetectorRef, Component, Inject, OnDestroy, OnInit } from '@angular/core';

import { DynamicCheckboxModel, DynamicFormControlEvent, DynamicFormControlModel } from '@ng-dynamic-forms/core';
import { Subscription } from 'rxjs/Subscription';

import { SectionModelComponent } from '../models/section.model';
import { JsonPatchOperationsBuilder } from '../../../core/json-patch/builder/json-patch-operations-builder';
import { CollectionDataService } from '../../../core/data/collection-data.service';
import { hasValue, isNotEmpty, isNotNull, isNotUndefined } from '../../../shared/empty.util';
import { License } from '../../../core/shared/license.model';
import { RemoteData } from '../../../core/data/remote-data';
import { Collection } from '../../../core/shared/collection.model';
import { SECTION_LICENSE_FORM_MODEL } from './section-license.model';
import { FormBuilderService } from '../../../shared/form/builder/form-builder.service';
import { FormService } from '../../../shared/form/form.service';
import { JsonPatchOperationPathCombiner } from '../../../core/json-patch/builder/json-patch-operation-path-combiner';
import { SectionsType } from '../sections-type';
import { renderSectionFor } from '../sections-decorator';
import { SectionDataObject } from '../models/section-data.model';
import { WorkspaceitemSectionLicenseObject } from '../../../core/submission/models/workspaceitem-section-license.model';
import { SubmissionService } from '../../submission.service';
import { SectionsService } from '../sections.service';
import { FormOperationsService } from '../form/form-operations.service';

@Component({
  selector: 'ds-submission-section-license',
  styleUrls: ['./section-license.component.scss'],
  templateUrl: './section-license.component.html',
})
@renderSectionFor(SectionsType.License)
export class LicenseSectionComponent extends SectionModelComponent implements OnDestroy, OnInit {

  public formId;
  public formModel: DynamicFormControlModel[];
  public displaySubmit = false;
  public licenseText: string;

  protected pathCombiner: JsonPatchOperationPathCombiner;
  protected subs: Subscription[] = [];

  constructor(protected changeDetectorRef: ChangeDetectorRef,
              protected collectionDataService: CollectionDataService,
              protected formBuilderService: FormBuilderService,
              protected formOperationsService: FormOperationsService,
              protected formService: FormService,
              protected operationsBuilder: JsonPatchOperationsBuilder,
              protected sectionService: SectionsService,
              protected submissionService: SubmissionService,
              @Inject('collectionIdProvider') public injectedCollectionId: string,
              @Inject('sectionDataProvider') public injectedSectionData: SectionDataObject,
              @Inject('submissionIdProvider') public injectedSubmissionId: string) {
    super(injectedCollectionId, injectedSectionData, injectedSubmissionId);
  }

  ngOnInit() {
    this.pathCombiner = new JsonPatchOperationPathCombiner('sections', this.sectionData.id);

    this.subs.push(
      this.collectionDataService.findById(this.collectionId)
        .filter((collectionData: RemoteData<Collection>) => isNotUndefined((collectionData.payload)))
        .flatMap((collectionData: RemoteData<Collection>) => collectionData.payload.license)
        .filter((licenseData: RemoteData<License>) => isNotUndefined((licenseData.payload)))
        .take(1)
        .subscribe((licenseData: RemoteData<License>) => {
          this.licenseText = licenseData.payload.text;
          this.formId = this.formService.getUniqueId(this.sectionData.id);
          this.formModel = this.formBuilderService.fromJSON(SECTION_LICENSE_FORM_MODEL);
          const model = this.formBuilderService.findById('granted', this.formModel);
          // Retrieve license accepted status
          if ((this.sectionData.data as WorkspaceitemSectionLicenseObject).granted) {
            (model as DynamicCheckboxModel).checked = true;
            this.sectionService.setSectionStatus(this.submissionId, this.sectionData.id, true);
          }

          // Disable checkbox whether it's in workflow or item scope
          this.sectionService.isSectionReadOnly(this.submissionId, this.sectionData.id, this.submissionService.getSubmissionScope())
            .take(1)
            .filter((isReadOnly) => isReadOnly)
            .subscribe(() => {
              model.disabled = true;
            });
          this.changeDetectorRef.detectChanges();
        }),

      this.sectionService.getSectionErrors(this.submissionId, this.sectionData.id)
        .filter((errors) => isNotEmpty(errors))
        .distinctUntilChanged()
        .subscribe((errors) => {
          // parse errors
          const newErrors = errors.map((error) => {
            // When the error path is only on the section,
            // replace it with the path to the form field to display error also on the form
            if (error.path === '/sections/license') {
              const model = this.formBuilderService.findById('granted', this.formModel);
              // check whether license is not accepted
              if (!(model as DynamicCheckboxModel).checked) {
                return Object.assign({}, error, {path: '/sections/license/granted'});
              } else {
                return null;
              }
            } else {
              return error;
            }
          }).filter((error) => isNotNull(error));

          if (isNotEmpty(newErrors)) {
            this.sectionService.checkSectionErrors(this.submissionId, this.sectionData.id, this.formId, newErrors);
            this.sectionData.errors = errors;
          } else {
            // Remove any section's errors
            this.sectionService.dispatchRemoveSectionErrors(this.submissionId, this.sectionData.id);
          }
          this.changeDetectorRef.detectChanges();
        })
    );
  }

  onChange(event: DynamicFormControlEvent) {
    const path = this.formOperationsService.getFieldPathSegmentedFromChangeEvent(event);
    const value = this.formOperationsService.getFieldValueFromChangeEvent(event);
    this.sectionService.setSectionStatus(this.submissionId, this.sectionData.id, value.value);
    if (value) {
      this.operationsBuilder.add(this.pathCombiner.getPath(path), value.value.toString(), false, true);
      // Remove any section's errors
      this.sectionService.dispatchRemoveSectionErrors(this.submissionId, this.sectionData.id);
    } else {
      this.operationsBuilder.remove(this.pathCombiner.getPath(path));
    }
  }

  ngOnDestroy() {
    this.subs
      .filter((subscription) => hasValue(subscription))
      .forEach((subscription) => subscription.unsubscribe());
  }

}
