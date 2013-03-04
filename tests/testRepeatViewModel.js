define([
	"../Stateful",
	"../FilteredStatefulArray",
	"dojox/mvc/StatefulArray"
], function(bind, FilteredStatefulArray, StatefulArray){
	var uniqueIdSeq = 0,
		collection = new StatefulArray([]),
		active = new FilteredStatefulArray(collection, function(entry){ return !entry.finished; }),
		finished = new FilteredStatefulArray(collection, function(entry){ return entry.finished; }),
		filtered = new FilteredStatefulArray(collection),
		count = bind(collection, "length"),
		activeCount = bind(active, "length"),
		finishedCount = bind(finished, "length"),
		filterMode = bind("");

	filterMode.then(function(mode){
		filtered.apply(function(entry){ return mode == "active" ? !entry.finished : mode == "finished" ? entry.finished : true; });
	});

	var viewModel = bind({
		collection: filtered,
		textToAdd: "",
		count: count,
		activeCount: activeCount,
		finishedCount: finishedCount,
		allSelected: bind(function(mode){
			return !/^(active|finished)$/.test(mode);
		}).to(filterMode),
		activeSelected: bind(function(mode){
			return mode == "active";
		}).to(filterMode),
		finishedSelected: bind(function(mode){
			return mode == "finished";
		}).to(filterMode),
		exists: bind(function(count){
			return count == 0;
		}).to(bind(filtered, "length")),
		allLabel: bind(function(count){
			return "All (" + count + ")";
		}).to(count),
		activeLabel: bind(function(count){
			return "Active (" + count + ")";
		}).to(activeCount),
		finishedLabel: bind(function(count){
			return "Finished (" + count + ")";
		}).to(finishedCount),
		addEntry: function(event, binding, viewModelBinding){
			var textToAdd = viewModelBinding.textToAdd;
			textToAdd.getValue(function(text){
				collection.push({id: uniqueIdSeq++, title: text, finished: false});
			});
			textToAdd.is("");
		},
		removeEntry: function(event, binding){
			binding.get("uniqueId", function(uniqueId){
				for(var i = collection.length - 1; i >= 0; --i){
					if(collection[i].id == uniqueId){
						collection.splice(i, 1);
					}
				}
			});
		},
		filter: function(event, binding){
			binding.get("filterMode", function(mode){
				filterMode.is(mode);
			});
		}
	});

	collection.push(
		{id: uniqueIdSeq++, title: "Wash my car", finished: false},
		{id: uniqueIdSeq++, title: "Walk my dog", finished: true});

	return viewModel;
});