import { Component, ViewChild, OnInit} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProjectService } from 'src/app/core/services/project.service';
import { Item, PullList } from 'src/app/core/types/types';
import { MatAccordion} from '@angular/material/expansion';

@Component({
  selector: 'app-item-list',
  templateUrl: './item-list.component.html',
  styleUrls: ['./item-list.component.scss']
})

export class ItemListComponent implements OnInit {
  @ViewChild(MatAccordion) accordion: MatAccordion;
  projService: ProjectService;
  subscription: Subscription = new Subscription();
  itemGroups: Array<Array<Item>> = [];
  itemList: Array<Item> = [];
  attributeNames: Array<string> = [];
  attributeValues: Array<string> = [];
  id: any;
  groupID: any;
  groups: any[];
  groupNames: any[] = [];
  status: string;
  pulled = false;
  prepped = false;
  loaded = false;
  lineItem: any;
  //trying diff one
  stages = [
    {name: 'Pulled', completed: false},
    {name: 'Prepped', completed: false},
    {name: 'Loaded', completed: false}
  ];
  pullList: PullList = {
    stages: this.stages, twoComplete: false, allComplete: false
  };
  //toggle
  isChecked = false;

  constructor(projService: ProjectService, private activatedRoute: ActivatedRoute) {
    this.projService = projService;
  }

  ngOnInit(): void {
    this.activatedRoute.paramMap.subscribe(params => {
      this.id = params.get('id');
      const info = this.projService.fetchItemDetails(this.id);
    });

    this.projService.fetchItemGroup(this.id).subscribe(response => {
      this.groups = response.events;
      for(const group of this.groups){
        this.projService.fetchItems(this.id, group.id).subscribe(
          res => {
            this.itemList = [];
            for(const lineItems of res.lineItemGroup.lineItems){
              this.lineItem = lineItems;
              for(const attribute of lineItems.item.attributes){
                      this.attributeNames.push(attribute.name);
                      this.attributeValues.push(attribute.value);
              }
              if(lineItems.allStagesSelected === false){
                this.status = 'Not Finished';
              }else if(lineItems.allStagesSelected === true){
                this.status = 'Finished';
              }
              this.pulled = false;
              this.prepped = false;
              this.loaded = false;

              for(const stage of lineItems.logisticsStages){
                if(stage.stageOrder === 0 && stage.selected === true){
                  this.pulled = stage.selected;
                }else if(stage.stageOrder === 1 && stage.selected === true){
                  this.prepped = stage.selected;
                }else if(stage.stageOrder === 2 && stage.selected === true){
                  this.loaded = stage.selected;
                }
              }
              this.stages = [
                {name: 'Pulled', completed: this.pulled},
                {name: 'Prepped', completed: this.prepped},
                {name: 'Loaded', completed: this.loaded}
              ];
              this.stages[0].name = lineItems.logisticsStages[0].name;
              this.stages[1].name = lineItems.logisticsStages[1].name;
              this.stages[2].name = lineItems.logisticsStages[2].name;
              this.pullList = {
                stages: this.stages, twoComplete: false, allComplete: false
              };
              const newItem: Item = {
                title: lineItems.itemTitle,
                id: lineItems.item.id,
                groupID: group.id,
                category: lineItems.rootCategory,
                subCategory: lineItems.primaryCategory,
                internalNotes: lineItems.internalNotes,
                attributeNames: this.attributeNames,
                attributeValues: this.attributeValues,
                quantity: lineItems.quantityBooked,
                status: this.status,
                pullSheet: this.pullList,
                lineItem: this.lineItem,
                childLevel: lineItems.childLevel,
                inventoryType: lineItems.item.inventoryType
              };
              this.itemList.push(newItem);
              this.attributeNames = [];
              this.attributeValues = [];
            }
            this.groupNames.push(group.name);
            this.itemGroups.push(this.itemList);
          });
        }
      });
    }

    // functions below are used to update the checkbox appropriately, will need to call post request service here most likely
    updateAllComplete(currSheet: PullList, currItem: Item) {
      const pullSheetComplete = currSheet.stages.filter(stage => !stage.completed).length === 0;
      currSheet.allComplete = currSheet.stages != null && pullSheetComplete;
      console.log('updateAllComplete:' + currSheet.allComplete);
      this.updatePullsheet(currItem);
    }

    updateTwoComplete(currSheet: PullList, currItem: Item) {
      currSheet.twoComplete = currSheet.stages != null && currSheet.stages[0].completed && currSheet.stages[1].completed;
      if(currSheet.twoComplete === false){
        currSheet.stages[1].completed = false;
        currItem.lineItem.logisticsStages[1].selected = false;
        currSheet.stages[2].completed = false;
        currItem.lineItem.logisticsStages[2].selected = false;
      }
      currItem.lineItem.logisticsStages[0].selected = currSheet.stages[0].completed;
      console.log('updateTwoComplete:' + currSheet.twoComplete);
      this.updatePullsheet(currItem);
    }

    setTwo(prepCompleted: boolean, currSheet: PullList, currItem: Item){
      currSheet.twoComplete = prepCompleted;
      if (currSheet.stages == null) {
        return;
      }
      console.log('setTwo:' + currSheet.twoComplete);
      if(currSheet.twoComplete === true){
        currSheet.stages[0].completed = prepCompleted;
        currItem.lineItem.logisticsStages[0].selected = prepCompleted;
        currSheet.stages[1].completed = prepCompleted;
        currItem.lineItem.logisticsStages[1].selected = prepCompleted;
      }else{
        currSheet.stages[1].completed = prepCompleted;
        currItem.lineItem.logisticsStages[1].selected = prepCompleted;
        currSheet.stages[2].completed = prepCompleted;
        currItem.lineItem.logisticsStages[2].selected = prepCompleted;
      }
      this.updatePullsheet(currItem);
    }

    setAll(completed: boolean, currSheet: PullList, currItem: Item) {
      currSheet.allComplete = completed;
      if (currSheet.stages == null) {
        return;
      }
      console.log('setAll:' + currSheet.allComplete);
      if(completed === true){
        currSheet.stages.forEach(t => (t.completed = completed));
        currItem.lineItem.logisticsStages.forEach(t => (t.selected = true));
      }
      this.updatePullsheet(currItem);
    }

    updatePullsheet(item: Item) {
      const data = item.lineItem;
      this.projService.pullsheetChange(data, item.groupID, this.id.toString()).subscribe( () => {
         // update fulfillment section
         this.projService.fetchItems(this.id, item.groupID).subscribe(res => {
          for(const lineItems of res.lineItemGroup.lineItems){
            if(lineItems.item.id === item.id){
              item.lineItem = lineItems;
            }
          }
        });
      });
    }
  }
