import React, { Dispatch, FunctionComponent, ReactNode, SyntheticEvent, useState } from 'react';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import Checkbox from '@mui/material/Checkbox';
import Tooltip from '@mui/material/Tooltip';
import FilterDate from '@components/common/lists/FilterDate';
import { Autocomplete, MenuItem, Select } from '@mui/material';
import { SelectChangeEvent } from '@mui/material/Select';
import SearchScopeElement from '@components/common/lists/SearchScopeElement';
import Chip from '@mui/material/Chip';
import { OptionValue } from '@components/common/lists/FilterAutocomplete';
import { addDays, subDays } from 'date-fns';
import { useTheme } from '@mui/material/styles';
import {
  DEFAULT_WITHIN_FILTER_VALUES,
  FilterSearchContext,
  getAvailableOperatorForFilter,
  getSelectedOptions,
  isBasicTextFilter,
  isNumericFilter,
  isStixObjectTypes,
  SELF_ID,
  SELF_ID_VALUE,
  useFilterDefinition,
} from '../../utils/filters/filtersUtils';
import { useFormatter } from '../i18n';
import ItemIcon from '../ItemIcon';
import { getOptionsFromEntities } from '../../utils/filters/SearchEntitiesUtil';
import { FilterDefinition } from '../../utils/hooks/useAuth';
import { FilterRepresentative } from './FiltersModel';
import useSearchEntities from '../../utils/filters/useSearchEntities';
import { Filter, handleFilterHelpers } from '../../utils/filters/filtersHelpers-types';
import useAttributes from '../../utils/hooks/useAttributes';
import BasicFilterInput from './BasicFilterInput';
import QuickRelativeDateFiltersButtons from './QuickRelativeDateFiltersButtons';
import DateRangeFilter from './DateRangeFilter';

interface FilterChipMenuProps {
  handleClose: () => void;
  open: boolean;
  params: FilterChipsParameter;
  filters: Filter[];
  helpers?: handleFilterHelpers;
  availableRelationFilterTypes?: Record<string, string[]>;
  filtersRepresentativesMap: Map<string, FilterRepresentative>;
  entityTypes?: string[];
  searchContext?: FilterSearchContext;
  availableEntityTypes?: string[];
  availableRelationshipTypes?: string[];
  fintelTemplatesContext?: boolean;
}

export interface FilterChipsParameter {
  filterId?: string;
  anchorEl?: HTMLElement;
}

const OperatorKeyValues: {
  [key: string]: string;
} = {
  eq: 'Equals',
  not_eq: 'Not equals',
  nil: 'Empty',
  not_nil: 'Not empty',
  gt: 'Greater than',
  gte: 'Greater than/ Equals',
  lt: 'Lower than',
  lte: 'Lower than/ Equals',
  contains: 'Contains',
  not_contains: 'Not contains',
  starts_with: 'Starts with',
  not_starts_with: 'Not starts with',
  ends_with: 'Ends with',
  not_ends_with: 'Not ends with',
  search: 'Search',
  within: 'Within',
};

export const FilterChipPopover: FunctionComponent<FilterChipMenuProps> = ({
  params,
  handleClose,
  open,
  filters,
  helpers,
  availableRelationFilterTypes,
  availableEntityTypes,
  availableRelationshipTypes,
  filtersRepresentativesMap,
  entityTypes,
  searchContext,
  fintelTemplatesContext,
}) => {
  const { t_i18n } = useFormatter();
  const theme = useTheme();
  const filter = filters.find((f) => f.id === params.filterId);
  const filterKey = filter?.key ?? '';
  const filterOperator = filter?.operator ?? '';
  const filterValues = filter?.values ?? [];
  const filterDefinition = useFilterDefinition(filterKey, entityTypes);
  const filterLabel = t_i18n(filterDefinition?.label ?? filterKey);
  const { typesWithFintelTemplates } = useAttributes();

  const [inputValues, setInputValues] = useState<{
    key: string;
    values: string[];
    operator?: string;
  }[]>(filter ? [filter] : []);
  const [cacheEntities, setCacheEntities] = useState<Record<string, OptionValue[]>>({});
  const [searchScope, setSearchScope] = useState<Record<string, string[]>>(
    availableRelationFilterTypes || {
      targets: [
        'Region',
        'Country',
        'Administrative-Area',
        'City',
        'Position',
        'Sector',
        'Organization',
        'Individual',
        'System',
        'Event',
        'Vulnerability',
      ],
    },
  );
  const [entities, searchEntities] = useSearchEntities({
    availableEntityTypes,
    availableRelationshipTypes,
    setInputValues,
    searchContext: { ...searchContext, entityTypes: [...(searchContext?.entityTypes ?? []), ...(entityTypes ?? [])] },
    searchScope,
  }) as [Record<string, OptionValue[]>, (
    filterKey: string,
    cacheEntities: Record<string, OptionValue[]>,
    setCacheEntities: Dispatch<Record<string, OptionValue[]>>,
    event: SyntheticEvent,
    isSubKey?: boolean,
  ) => Record<string, OptionValue[]>,
  ];
  const handleChange = (checked: boolean, value: string, childKey?: string) => {
    if (childKey) {
      const childFilters = filter?.values.filter((val) => val.key === childKey) as Filter[];
      const childFilter = childFilters && childFilters.length > 0 ? childFilters[0] : undefined;
      const alreadySelectedValues = childFilter?.values ?? [];
      let representationToAdd;
      if (checked) {
        // the representation to add = the former values + the added value
        representationToAdd = { key: childKey, values: [...alreadySelectedValues, value] };
      } else {
        const cleanedValues = alreadySelectedValues.filter((val) => val !== value);
        // the representation to add = the former values - the removed value
        representationToAdd = cleanedValues.length > 0 ? { key: childKey, values: cleanedValues } : undefined;
      }
      helpers?.handleChangeRepresentationFilter(filter?.id ?? '', childFilter, representationToAdd);
    } else if (checked) {
      helpers?.handleAddRepresentationFilter(filter?.id ?? '', value);
    } else {
      helpers?.handleRemoveRepresentationFilter(filter?.id ?? '', value);
    }
  };

  const handleChangeOperator = (event: SelectChangeEvent, fDef?: FilterDefinition) => {
    const filterType = fDef?.type;
    const newOperator = event.target.value;
    // for date check (date in days, operator) correspond to (timestamp in seconds, operator)
    if (filterType === 'date' && filter && filter.values.length > 0) {
      const formerOperator = filter?.operator;
      const formerDate = filter.values[0]; // dates filters have a single value
      if (formerOperator && ['lte', 'gt'].includes(formerOperator) && ['lt', 'gte'].includes(newOperator)) {
        const newDate = subDays(new Date(formerDate), -1).toISOString();
        const newInputValue = { key: filterKey, values: [newDate], newOperator };
        setInputValues([newInputValue]);
        helpers?.handleAddSingleValueFilter(filter?.id ?? '', newDate);
      } else if (formerOperator && ['lt', 'gte'].includes(formerOperator) && ['lte', 'gt'].includes(newOperator)) {
        const newDate = addDays(new Date(formerDate), 1).toISOString();
        const newInputValue = { key: filterKey, values: [newDate], newOperator };
        setInputValues([newInputValue]);
        helpers?.handleAddSingleValueFilter(filter?.id ?? '', newDate);
      }
    }
    // modify the operator
    helpers?.handleChangeOperatorFilters(filter?.id ?? '', newOperator);
  };
  const handleDateChange = (_: string, value: string) => {
    // convert the date to handle comparison with a timestamp
    const date = new Date(value);
    let filterDate = date;
    if (filter?.operator === 'lte' || filter?.operator === 'gt') { // lte date <=> lte (date+1 0:0:0)  /// gt date <=> gt (date+1 0:0:0)
      filterDate = addDays(date, 1);
    }
    helpers?.handleAddSingleValueFilter(filter?.id ?? '', filterDate.toISOString());
  };

  const isSpecificFilter = (fDef?: FilterDefinition) => {
    const filterType = fDef?.type;
    return (
      filterType === 'date'
      || isNumericFilter(filterType)
      || isBasicTextFilter(fDef)
    );
  };

  const BasicFilterDate = ({ value }: { value?: string }) => (
    <FilterDate
      defaultHandleAddFilter={handleDateChange}
      filterKey={filterKey}
      operator={filterOperator}
      inputValues={inputValues}
      setInputValues={setInputValues}
      filterLabel={filterLabel}
      filterValue={value}
    />
  );

  const noValueOperator = !['not_nil', 'nil'].includes(filterOperator);
  const renderSearchScopeSelection = (key: string) => (
    <SearchScopeElement
      name={key}
      searchScope={searchScope}
      setSearchScope={setSearchScope}
      availableRelationFilterTypes={availableRelationFilterTypes}
    />
  );

  const buildAutocompleteFilter = (fKey: string, fLabel?: string, subKey?: string): ReactNode => {
    const getEntitiesOptions = getOptionsFromEntities(entities, searchScope, fKey);
    const optionsValues = subKey ? (filterValues.find((f) => f.key === subKey)?.values ?? []) : filterValues;

    const completedTypesWithFintelTemplates = typesWithFintelTemplates.concat(['Container', 'Stix-Domain-Object', 'Stix-Core-Object']);
    const shouldAddSelfId = fintelTemplatesContext
      && (filterDefinition?.type === 'id' || (filterDefinition?.filterKey === 'regardingOf' && subKey === 'id'))
      && (filterDefinition?.elementsForFilterValuesSearch ?? []).every((type) => completedTypesWithFintelTemplates.includes(type));

    const getOptions = shouldAddSelfId
      ? [
        {
          value: SELF_ID,
          label: SELF_ID_VALUE,
          group: 'Instance',
          parentTypes: [],
          color: 'primary',
          type: 'Instance',
        },
        ...getEntitiesOptions,
      ]
      : getEntitiesOptions;

    const entitiesOptions = getOptions.filter((option) => !optionsValues.includes(option.value));
    const selectedOptions: OptionValue[] = getSelectedOptions(getOptions, optionsValues, filtersRepresentativesMap, t_i18n);

    const options = [...selectedOptions, ...entitiesOptions];

    const groupByEntities = (option: OptionValue, label?: string) => {
      return t_i18n(option?.group ? option?.group : label);
    };
    return (
      <Autocomplete
        multiple
        key={fKey}
        getOptionLabel={(option) => option.label ?? ''}
        noOptionsText={t_i18n('No available options')}
        options={options}
        groupBy={(option) => groupByEntities(option, fLabel)}
        onInputChange={(event) => searchEntities(fKey, cacheEntities, setCacheEntities, event, !!subKey)}
        renderInput={(paramsInput) => (
          <TextField
            {...paramsInput}
            slotProps={{
              input: {
                ...paramsInput.InputProps,
                endAdornment: isStixObjectTypes.includes(fKey)
                  ? renderSearchScopeSelection(fKey)
                  : paramsInput.InputProps.endAdornment,
              },
            }}
            label={t_i18n(fLabel)}
            variant="outlined"
            size="small"
            fullWidth={true}
            autoFocus={true}
            onFocus={(event) => searchEntities(
              fKey,
              cacheEntities,
              setCacheEntities,
              event,
              !!subKey,
            )
            }
          />
        )}
        renderOption={(props, option) => {
          const checked = subKey
            ? filterValues.filter((fVal) => fVal && fVal.key === subKey && fVal.values.includes(option.value)).length > 0
            : filterValues.includes(option.value);
          return (
            <Tooltip title={option.label} key={option.label} followCursor>
              <li
                {...props}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                  }
                }}
                onClick={() => handleChange(!checked, option.value, subKey)}
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  padding: 0,
                  margin: 0,
                }}
              >
                <Checkbox checked={checked} />
                <ItemIcon type={option.type} color={option.color} />
                <span style={{ padding: '0 4px 0 4px' }}>
                  {option.label}
                </span>
              </li>
            </Tooltip>
          );
        }}
      />
    );
  };
  const getSpecificFilter = (fDefinition?: FilterDefinition): ReactNode => {
    if (fDefinition?.type === 'date') {
      if (filterOperator === 'within') {
        const values = filterValues.length > 0 ? filterValues : DEFAULT_WITHIN_FILTER_VALUES;
        return (
          <DateRangeFilter
            filter={filter}
            filterKey={filterKey}
            filterValues={values}
            helpers={helpers}
          />
        );
      }
      return <BasicFilterDate value={filterValues.length > 0 ? filterValues[0] : undefined} />;
    }
    if (isNumericFilter(fDefinition?.type)) {
      return (
        <BasicFilterInput
          filter={filter}
          filterKey={filterKey}
          filterValues={filterValues}
          helpers={helpers}
          label={filterLabel}
          type={'number'}
        />
      );
    }
    if (isBasicTextFilter(filterDefinition)) {
      return (
        <BasicFilterInput
          filter={filter}
          filterKey={filterKey}
          filterValues={filterValues}
          helpers={helpers}
          label={filterLabel}
        />
      );
    }
    return null;
  };

  const displayOperatorAndFilter = (fKey: string, subKey?: string) => {
    const availableOperators = getAvailableOperatorForFilter(filterDefinition, subKey);
    const finalFilterDefinition = useFilterDefinition(fKey, entityTypes, subKey);
    return (
      <>
        <Select
          labelId="change-operator-select-label"
          id="change-operator-select"
          value={filterOperator}
          label="Operator"
          fullWidth={true}
          onChange={(event) => handleChangeOperator(event, finalFilterDefinition)}
          style={{ marginBottom: 15 }}
        >
          {availableOperators.map((value) => (
            <MenuItem key={value} value={value}>
              {t_i18n(OperatorKeyValues[value])}
            </MenuItem>
          ))}
        </Select>
        {noValueOperator && isSpecificFilter(finalFilterDefinition) && (
          <>{getSpecificFilter(finalFilterDefinition)}</>
        )}
        {noValueOperator && !isSpecificFilter(finalFilterDefinition) && (
          <>{buildAutocompleteFilter(subKey ?? fKey, finalFilterDefinition?.label ?? t_i18n(fKey), subKey)}</>
        )}
      </>
    );
  };

  return (
    <Popover
      open={open}
      anchorEl={params.anchorEl}
      onClose={handleClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'left',
      }}
      slotProps={{ paper: { elevation: 1, style: { marginTop: 10 } } }}
    >
      {filterDefinition?.subFilters && filterDefinition.subFilters.length > 1
        ? <div
            style={{
              width: 250,
              padding: 8,
            }}
          >
          {displayOperatorAndFilter(filterKey, filterDefinition?.subFilters[0].filterKey)}
          <Chip
            style={{
              fontFamily: 'Consolas, monaco, monospace',
              margin: '10px 10px 15px 0',
            }}
            label={t_i18n('WITH')}
          />
          {displayOperatorAndFilter(filterKey, filterDefinition.subFilters[1].filterKey)}
        </div>
        : <div style={{ display: 'inline-flex' }}>
          <div
            style={{
              width: 250,
              padding: 8,
            }}
          >
            {displayOperatorAndFilter(filterKey)}
          </div>
          {filterOperator === 'within'
            && <div style={{ width: 150, display: 'inline-flex' }}>
              <div style={{
                color: theme.palette.text.disabled,
                borderLeft: '0.5px solid',
                marginLeft: '10px',
                marginTop: '10px',
                marginBottom: '10px',
              }}
              />
              <QuickRelativeDateFiltersButtons filter={filter} helpers={helpers} handleClose={handleClose} />
            </div>
          }
        </div>
      }
    </Popover>
  );
};
