import { autoserialize, autoserializeAs, inheritSerialization } from 'cerialize';

import { WorkspaceItemError, Workspaceitem } from './workspaceitem.model';
import { WorkspaceitemSectionsObject } from './workspaceitem-sections.model';

import { NormalizedSubmissionObject } from './normalized-submission-object.model';
import { NormalizedDSpaceObject } from '../../cache/models/normalized-dspace-object.model';
import { mapsTo, relationship } from '../../cache/builders/build-decorators';
import { NormalizedCollection } from '../../cache/models/normalized-collection.model';
import { ResourceType } from '../../shared/resource-type';
import { SubmissionDefinitionsModel } from '../../shared/config/config-submission-definitions.model';
import { EpersonModel } from '../../eperson/models/eperson.model';

@mapsTo(Workspaceitem)
@inheritSerialization(NormalizedDSpaceObject)
export class NormalizedWorkspaceItem extends NormalizedSubmissionObject {

  /**
   * The workspaceitem identifier
   */
  @autoserialize
  id: string;

  /**
   * The workspaceitem last modified date
   */
  @autoserialize
  lastModified: Date;

  @autoserializeAs(NormalizedCollection)
  collection: NormalizedCollection[];

  @autoserialize
  @relationship(ResourceType.Item, true)
  item: string[];

  @autoserialize
  sections: WorkspaceitemSectionsObject;

  @autoserializeAs(SubmissionDefinitionsModel)
  submissionDefinition: SubmissionDefinitionsModel;

  @autoserializeAs(EpersonModel)
  submitter: EpersonModel;

  @autoserialize
  errors: WorkspaceItemError[]
}