import { FormFieldMetadataValueObject } from '../../../shared/form/builder/models/form-field-metadata-value.model';
import { WorkspaceitemSectionUploadFileObject } from './workspaceitem-section-upload-file.model';

export interface WorkspaceitemSectionRecycleObject {
  unexpected: any;
  metadata: FormFieldMetadataValueObject[];
  files: WorkspaceitemSectionUploadFileObject[];
}