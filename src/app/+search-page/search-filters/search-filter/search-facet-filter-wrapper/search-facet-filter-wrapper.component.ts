import { Component, Injector, Input, OnInit } from '@angular/core';
import { renderFilterType } from '../search-filter-type-decorator';
import { FilterType } from '../../../search-service/filter-type.model';
import { SearchFilterConfig } from '../../../search-service/search-filter-config.model';
import { FILTER_CONFIG } from '../search-filter.service';
import { GenericConstructor } from '../../../../core/shared/generic-constructor';
import { SearchFacetFilterComponent } from '../search-facet-filter/search-facet-filter.component';

@Component({
  selector: 'ds-search-facet-filter-wrapper',
  templateUrl: './search-facet-filter-wrapper.component.html'
})

/**
 * Wrapper component that renders a specific facet filter based on the filter config's type
 */
export class SearchFacetFilterWrapperComponent implements OnInit {
  /**
   * Configuration for the filter of this wrapper component
   */
  @Input() filterConfig: SearchFilterConfig;

  /**
   * The constructor of the search facet filter that should be rendered, based on the filter config's type
   */
  searchFilter: GenericConstructor<SearchFacetFilterComponent>;
  /**
   * Injector to inject a child component with the @Input parameters
   */
  objectInjector: Injector;

  constructor(private injector: Injector) {
  }

  /**
   * Initialize and add the filter config to the injector
   */
  ngOnInit(): void {
    this.searchFilter = this.getSearchFilter();
    this.objectInjector = Injector.create({
      providers: [
        { provide: FILTER_CONFIG, useFactory: () => (this.filterConfig), deps: [] }
      ],
      parent: this.injector
    });
  }

  /**
   * Find the correct component based on the filter config's type
   */
  private getSearchFilter() {
    const type: FilterType = this.filterConfig.type;
    return renderFilterType(type);
  }
}