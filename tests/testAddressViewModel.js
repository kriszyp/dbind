define([
	"./testEmployeeStore",
	"../bind",
	"../Selection",
	"dojox/mvc/StatefulArray",
	"../Snapshot"
], function(EmployeeStore, bind, SelectionBinding, StatefulArray){
	var inited,
		table = {},
		groups = new StatefulArray([]),
		store = new EmployeeStore(),
		collection = new StatefulArray([]);

	groups.push({value: "All", innerText: "All"});

	var viewModel = bind({
		group: "All",
		groups: groups,
		collection: collection,
		selection: bind(collection),
		select: function(){
			var uniqueId = this.uniqueId;
			bind(collection).to(function(entry){
				return entry.id == uniqueId;
			}, true);
		},
		pushCurrent: function(){
			bind(collection).push();
		},
		pullCurrent: function(){
			bind(collection).pull();
		},
		pushAll: function(){
			for(var i = 0, l = collection.length; i < l; ++i){
				bind(collection[i]).push();
			}
		},
		pullAll: function(){
			for(var i = 0, l = collection.length; i < l; ++i){
				bind(collection[i]).pull();
			}
		}
	});

	var oldGroup;
	viewModel.get("group", function(value){
		if(oldGroup != value){
			var i, l, dirty;
			for(i = 0, l = collection.length; !dirty && i < l; ++i){
				bind(collection[i]).dirty() && (dirty = true);
			}
			if(viewModel.supportSave && dirty && !confirm("You have unsaved data. Would you like to proceed anyway?")){
				viewModel.get("group").is(oldGroup);
				return;
			}

			var data = store.query(value == "All" ? {} : {Group: value});
			collection.splice.apply(collection, [0, collection.length].concat(data));

			if(!inited){
				bind(collection).use(bind.keepSnapshot, SelectionBinding.fallbackSelection);
				inited = true;
			}

			var list = [];
			for(i = 0, l = data.length; i < l; ++i){
				table[data[i].Group] = 1;
			}
			for(var s in table){
				list.push({value: s, innerText: s});
			}
			groups.splice.apply(groups, [1, groups.length - 1].concat(list));
			oldGroup = value;
		}
	});

	return viewModel;
});
