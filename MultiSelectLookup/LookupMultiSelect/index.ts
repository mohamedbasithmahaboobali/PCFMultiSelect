import { IInputs, IOutputs } from "./generated/ManifestTypes";

declare const Xrm: any;

// Extended interface to carry optional subtexts
interface ExtendedLookupValue extends ComponentFramework.LookupValue {
  subText1?: string;
  subText2?: string;
}

export class LookupMultiSelect implements ComponentFramework.StandardControl<IInputs, IOutputs> {
  private _selectedItems: ExtendedLookupValue[] = [];
  private _container: HTMLDivElement;
  private _mainField: HTMLDivElement;
  private _dropdownContainer: HTMLDivElement;
  private _searchInputContainer: HTMLDivElement;
  private _searchInput: HTMLInputElement;
  private _searchIcon: HTMLElement;
  private _notifyOutputChanged: () => void;
  private subTextField1: string = "";
  private subTextField2: string = "";
  private _selectedItemsContainer: HTMLDivElement;
  private _dropdownScrollTop: number = 0;
  private _lookupEntityLogicalName: string;
  private _nameFieldLogicalName: string;
  private _lookupEntityDisplayName: string;
  //private _newButton: HTMLButtonElement;
  private _namesFieldValue: string = "";

  // Search-related
  private _pageSize: number = 1000;
  private _lastSearch: string = "";

  public init(
    context: ComponentFramework.Context<IInputs>,
    notifyOutputChanged: () => void,
    state: ComponentFramework.Dictionary,
    container: HTMLDivElement
  ): void {
    this._container = container;
    this._notifyOutputChanged = notifyOutputChanged;

    this._lookupEntityDisplayName = context.parameters.LookupEntityDisplayName.raw ?? "Record";
    this._lookupEntityLogicalName = context.parameters.LookupEntityLogicalName.raw ?? "";
    this._nameFieldLogicalName = context.parameters.NameFieldLogicalName.raw ?? "";

    this.parseHiddenField(context);

    this.subTextField1 = context.parameters.LookupOption1LogicalName?.raw ?? "";
    this.subTextField2 = context.parameters.LookupOption2LogicalName?.raw ?? "";

    this.createMainField();
    this.injectCSS();
    this.updateView();
    this.loadItems(context);
  }

// Backwards-compatible aliases: some manifests use slightly different constructor
// names (case or spelling variations). Export small subclass aliases so the
// build/validation can find a class with those constructor names.
// aliases removed to keep single export required by pcf-scripts
  private parseHiddenField(context: ComponentFramework.Context<IInputs>): void {
    try {
      const hiddenFieldRaw = context.parameters.hiddenField.raw;
      this._selectedItems = hiddenFieldRaw ? JSON.parse(hiddenFieldRaw) : [];
    } catch (_error) {
      // Keep silent in production; ensure resilience
      this._selectedItems = [];
    }
    this.updateNamesField();
  }

  private createMainField(): void {
    this._mainField = document.createElement("div");
    this._mainField.className = "main-field";

    // New quick-create button
    //this._newButton = document.createElement("button");
    //this._newButton.className = "new-entity-button";
    //this._newButton.textContent = `New ${this._lookupEntityDisplayName}`;
    //this._newButton.addEventListener("click", this.openNewForm.bind(this));

    // Selected items container
    this._selectedItemsContainer = document.createElement("div");
    this._selectedItemsContainer.className = "selected-items-container";

    // Search input UI
    this._searchInputContainer = document.createElement("div");
    this._searchInputContainer.className = "search-input-container";

    this._searchInput = document.createElement("input");
    this._searchInput.type = "text";
    this._searchInput.className = "search-input";
    this._searchInput.placeholder = "Search here";
    // Debounced server-side search
    this._searchInput.addEventListener("input", this.debounce(this.filterItems.bind(this), 300));

    this._searchIcon = document.createElement("i");
    this._searchIcon.className = "fas fa-search search-icon";
    this._searchIcon.addEventListener("click", this.toggleDropdown.bind(this));

    this._dropdownContainer = document.createElement("div");
    this._dropdownContainer.className = "dropdown-container";
    this._dropdownContainer.style.display = "none";

    this._searchInputContainer.appendChild(this._searchInput);
    this._searchInputContainer.appendChild(this._searchIcon);

    this._mainField.appendChild(this._selectedItemsContainer);
    //this._mainField.appendChild(this._newButton);
    this._mainField.appendChild(this._searchInputContainer);
    this._mainField.appendChild(this._dropdownContainer);

    this._container.appendChild(this._mainField);
  }

  private retrieveData(
    entityLogicalName: string,
    fieldLogicalName: string,
    searchText?: string,
    top: number = this._pageSize
  ): void {
    if (typeof Xrm !== "undefined") {
      const selectFields = `${fieldLogicalName},${entityLogicalName}id` +
        (this.subTextField1 ? `,${this.subTextField1}` : "") +
        (this.subTextField2 ? `,${this.subTextField2}` : "");

      // $top and $orderby for top N sorted results
      let query = `?$select=${selectFields}&$orderby=${fieldLogicalName} asc&$top=${top}`;

      // Filters: active only + optional contains(name,'text')
      const filterConditions: string[] = ["statecode eq 0"]; // Active records
      if (searchText && searchText.trim() !== "") {
        const escaped = searchText.replace(/'/g, "''");
        filterConditions.push(`contains(${fieldLogicalName},'${escaped}')`);
      }
      query += `&$filter=${encodeURIComponent(filterConditions.join(" and "))}`;

      Xrm.WebApi.retrieveMultipleRecords(entityLogicalName, query).then(
        (result: any) => {
          const lookupData: ExtendedLookupValue[] = result.entities.map((entity: any) => ({
            id: entity[`${entityLogicalName}id`],
            entityType: entityLogicalName,
            name: entity[fieldLogicalName],
            subText1: this.subTextField1 ? entity[this.subTextField1] : "",
            subText2: this.subTextField2 ? entity[this.subTextField2] : ""
          } as ExtendedLookupValue));

          this.populateDropdown(lookupData);
          this.syncCheckboxes();
        },
        (_error: any) => {
          try {
            if (Xrm?.Navigation?.openAlertDialog) {
              Xrm.Navigation.openAlertDialog({ text: "Unable to load lookup records." });
            }
          } catch { /* no-op */ }
        }
      );
    }
  }

  private updateNamesField(): void {
    this._namesFieldValue = this._selectedItems.map(item => item.name).join(", ");
    this._notifyOutputChanged();
  }

  private openNewForm(): void {
    if (typeof Xrm !== "undefined") {
      const formOptions = {
        entityName: this._lookupEntityLogicalName,
        useQuickCreateForm: true
      };
      Xrm.Navigation.openForm(formOptions).then(
        (result: any) => {
          if (result && result.savedEntityReference && result.savedEntityReference.length > 0) {
            const newRecordId = result.savedEntityReference[0].id;
            this.retrieveSpecificRecord(newRecordId);
          }
        },
        (_error: any) => {
          try { if (Xrm?.Navigation?.openAlertDialog) Xrm.Navigation.openAlertDialog({ text: "Unable to open quick create form." }); } catch { /* no-op */ }
        }
      );
    }
  }

  private retrieveSpecificRecord(recordId: string): void {
    if (typeof Xrm !== "undefined") {
      const selectFields = `${this._nameFieldLogicalName},${this._lookupEntityLogicalName}id` +
        (this.subTextField1 ? `,${this.subTextField1}` : "") +
        (this.subTextField2 ? `,${this.subTextField2}` : "");

      const query = `?$select=${selectFields}&$filter=${this._lookupEntityLogicalName}id eq ${recordId}`;
      Xrm.WebApi.retrieveRecord(this._lookupEntityLogicalName, recordId, query).then(
        (newRecord: any) => {
          const lookupValue: ExtendedLookupValue = {
            id: newRecord[`${this._lookupEntityLogicalName}id`],
            entityType: this._lookupEntityLogicalName,
            name: newRecord[this._nameFieldLogicalName],
            subText1: this.subTextField1 ? newRecord[this.subTextField1] : "",
            subText2: this.subTextField2 ? newRecord[this.subTextField2] : ""
          };

          if (!this._selectedItems.some(item => item.id === lookupValue.id)) {
            this._selectedItems.push(lookupValue);
            this.updateNamesField();
            this._notifyOutputChanged();
            this.retrieveData(this._lookupEntityLogicalName, this._nameFieldLogicalName, "", this._pageSize);
            this.updateView();
          }
        },
        (_error: any) => {
          try { if (Xrm?.Navigation?.openAlertDialog) Xrm.Navigation.openAlertDialog({ text: "Failed to load the newly created record." }); } catch { /* no-op */ }
        }
      );
    }
  }

  private debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
    let timeout: number | undefined;
    return (...args: Parameters<T>) => {
      if (timeout !== undefined) clearTimeout(timeout);
      timeout = window.setTimeout(() => func.apply(this, args), wait);
    };
  }

  private injectCSS(): void {
    const fontAwesomeLink = document.createElement('link');
    fontAwesomeLink.rel = 'stylesheet';
    fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
    document.head.appendChild(fontAwesomeLink);
  }

  private loadItems(context: ComponentFramework.Context<IInputs>): void {
    const lookupEntityLogicalName = context.parameters.LookupEntityLogicalName.raw ?? "";
    const NameFieldLogicalName = context.parameters.NameFieldLogicalName.raw ?? "";
    // Initial fetch: top 1000 active records
    this.retrieveData(lookupEntityLogicalName, NameFieldLogicalName, "", this._pageSize);
    this.syncCheckboxes();
  }

  private populateDropdown(lookupData: ExtendedLookupValue[]): void {
    // Clear safely without innerHTML
    while (this._dropdownContainer.firstChild) {
      this._dropdownContainer.removeChild(this._dropdownContainer.firstChild);
    }

    lookupData.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

    lookupData.forEach(item => {
      const optionDiv = document.createElement("div");
      optionDiv.className = "lookup-option";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = item.id;
      checkbox.id = `checkbox-${item.id}`;
      checkbox.addEventListener("change", (event) => this.onCheckboxChange(event, item));

      const label = document.createElement("label");
      label.htmlFor = `checkbox-${item.id}`;
      label.textContent = item.name ?? "";

      const subText = document.createElement("div");
      subText.className = "sub-text";
      if (item.subText1 && item.subText1.trim() !== "") {
        subText.textContent = item.subText1;
      } else if (item.subText2 && item.subText2.trim() !== "") {
        subText.textContent = item.subText2;
      } else {
        subText.textContent = "";
      }

      optionDiv.appendChild(checkbox);
      optionDiv.appendChild(label);
      optionDiv.appendChild(subText);
      this._dropdownContainer.appendChild(optionDiv);

      optionDiv.addEventListener("mouseover", () => { optionDiv.style.backgroundColor = "#f0f0f0"; });
      optionDiv.addEventListener("mouseout", () => { optionDiv.style.backgroundColor = ""; });

      optionDiv.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        checkbox.checked = !checkbox.checked;
        this.onCheckboxChange({ target: checkbox } as unknown as Event, item);
      });

      checkbox.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    });
  }

  private onCheckboxChange(event: Event, item: ExtendedLookupValue): void {
    const checkbox = event.target as HTMLInputElement;
    if (checkbox.checked) {
      if (!this._selectedItems.some(i => i.id === item.id)) {
        this._selectedItems.push(item);
        setTimeout(() => {
          const selectedItemElement = this._selectedItemsContainer.querySelector(`#selected-${item.id}`);
          if (selectedItemElement) {
            selectedItemElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        }, 100);
      }
    } else {
      this._selectedItems = this._selectedItems.filter(i => i.id !== item.id);
    }
    this.updateNamesField();
    this._notifyOutputChanged();
    this.updateView();
  }

  private filterItems(): void {
    const searchText = this._searchInput.value.trim();

    // Avoid redundant calls when nothing changed and dropdown already visible
    if (searchText === this._lastSearch && this._dropdownContainer.style.display === 'flex') {
      return;
    }
    this._lastSearch = searchText;

    this.retrieveData(this._lookupEntityLogicalName, this._nameFieldLogicalName, searchText, this._pageSize);

    // Show dropdown after (re)query
    this._dropdownContainer.style.display = 'flex';
  }

  private toggleDropdown(): void {
    const isDropdownVisible = this._dropdownContainer.style.display === 'flex';
    if (isDropdownVisible) {
      this._dropdownContainer.style.display = 'none';
    } else {
      // Trigger a server-side fetch based on current text
      this.filterItems();
    }
  }

  public updateView(context?: ComponentFramework.Context<IInputs>): void {
    if (context && context.parameters.hiddenField.raw !== JSON.stringify(this._selectedItems)) {
      this.parseHiddenField(context);
    }

    // Clear safely without innerHTML
    while (this._selectedItemsContainer.firstChild) {
      this._selectedItemsContainer.removeChild(this._selectedItemsContainer.firstChild);
    }

    this._selectedItems.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

    this._selectedItems.forEach(item => {
      const selectedItemDiv = document.createElement('div');
      selectedItemDiv.className = 'selected-item';
      selectedItemDiv.id = `selected-${item.id}`;

      const selectedItemLink = document.createElement('a');
      selectedItemLink.className = 'selected-item-link';
      selectedItemLink.textContent = item.name ?? '';
      selectedItemLink.href = 'javascript:void(0);';
      selectedItemLink.addEventListener('click', () => this.openRecord(item));

      const crossIcon = document.createElement('button');
      crossIcon.type = 'button';
      crossIcon.className = 'cross-icon';
      crossIcon.setAttribute('aria-label', 'Remove');
      crossIcon.appendChild(document.createTextNode('✖'));
      crossIcon.addEventListener('click', () => this.deselectItem(item));

      selectedItemDiv.appendChild(selectedItemLink);
      selectedItemDiv.appendChild(crossIcon);
      this._selectedItemsContainer.appendChild(selectedItemDiv);
    });

    if (!this._mainField.contains(this._searchInputContainer)) this._mainField.appendChild(this._searchInputContainer);
    if (!this._mainField.contains(this._dropdownContainer)) this._mainField.appendChild(this._dropdownContainer);

    this.syncCheckboxes();

    this._selectedItemsContainer.style.display = this._selectedItems.length === 0 ? "none" : "flex";
  }

  private openRecord(item: ExtendedLookupValue): void {
    if (typeof Xrm !== "undefined") {
      const entityFormOptions = {
        entityName: item.entityType,
        entityId: item.id,
      };
      Xrm.Navigation.openForm(entityFormOptions).then(
        () => { /* success: no-op */ },
        (_error: any) => {
          try { if (Xrm?.Navigation?.openAlertDialog) Xrm.Navigation.openAlertDialog({ text: "Unable to open the record form." }); } catch { /* no-op */ }
        }
      );
    }
  }

  private deselectItem(item: ExtendedLookupValue): void {
    const index = this._selectedItems.findIndex(i => i.id === item.id);
    if (index !== -1) {
      this._selectedItems.splice(index, 1);
      this.updateNamesField();
      this._notifyOutputChanged();
      this.updateView();
    }
  }

  private syncCheckboxes(): void {
    const checkboxes = this._dropdownContainer.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((checkbox) => {
      const inputElement = checkbox as HTMLInputElement;
      inputElement.checked = this._selectedItems.some(item => item.id === inputElement.value);
    });
  }

  public getOutputs(): IOutputs {
    return {
      hiddenField: this._selectedItems.length > 0 ? JSON.stringify(this._selectedItems) : "",
      recordNamesField: this._namesFieldValue
    };
  }

  public destroy(): void {
    // Cleanup if needed
  }
}

