define([
	"../bind",
	"../store/Observable",
	"dojo/_base/array",
	"dojo/_base/lang",
	"dojo/when",
	"dojo/store/Memory",
	"dojo/promise/all"
], function(bind, Observable, array, lang, when, Memory, all){
	var collection = Observable(new Memory({data: [
			{id: 0, title: "Wash my car", finished: false},
			{id: 1, title: "Walk my dog", finished: true}
		]})),
		results = collection.query({}),
		unfiltered = collection.query({filtered: {test: function(value){ return !value; }}}),
		active = collection.query({finished: {test: function(value){ return !value; }}}),
		finished = collection.query({finished: {test: function(value){ return value; }}}),
		count = bind(0),
		unfilteredCount = bind(0),
		activeCount = bind(0),
		finishedCount = bind(0),
		filterMode = bind(""),
		currentFilterMode = "";

	results.observe(function(idx, removals, adds){
		when(results, function(results){
			count.is(results.length);
		});
		array.forEach(removals, function(removal){
			bind(removal).remove();
		});
		array.forEach(adds, function(add){
			var filtered = add.finished && currentFilterMode == "active" || !add.finished && currentFilterMode == "finished";
			if(add.filtered ^ filtered){
				collection.put(lang.mixin(add, {filtered: filtered}));
			}
			var lastFinished;
			bind(add).get("finished", function(finished){
				if(lastFinished ^ finished){
					collection.put(lang.delegate(add, {finished: lastFinished = finished, filtered: finished && currentFilterMode == "active" || !finished && currentFilterMode == "finished"})); // To avoid race-condition finished state is sent to the entry vs. this callback
				}
			});
		});
	}, false, true);

	unfiltered.observe(function(){
		when(unfiltered, function(unfiltered){
			unfilteredCount.is(unfiltered.length);
		});
	});

	active.observe(function(){
		when(active, function(active){
			activeCount.is(active.length);
		});
	}, false, true);

	finished.observe(function(){
		when(finished, function(finished){
			finishedCount.is(finished.length);
		});
	}, false, true);

	when(results, function(a){
		count.is(a.length);
		array.forEach(a, function(entry){
			var lastFinished;
			bind(entry).get("finished", function(finished){
				if(lastFinished ^ finished){
					collection.put(lang.delegate(entry, {finished: lastFinished = finished, filtered: finished && currentFilterMode == "active" || !finished && currentFilterMode == "finished"})); // To avoid race-condition finished state is sent to the entry vs. this callback
				}
			});
		});
	});

	when(active, function(a){
		activeCount.is(a.length);
	});

	when(finished, function(a){
		finishedCount.is(a.length);
	});

	filterMode.receive(function(mode){
		if(currentFilterMode != mode){
			currentFilterMode = mode;
			when(all([active, finished]), function(pair){
				array.forEach(pair[0], function(entry){
					collection.put(lang.mixin(entry, {filtered: mode == "finished"}));
				});
				array.forEach(pair[1], function(entry){
					collection.put(lang.mixin(entry, {filtered: mode == "active"}));
				});
			});
		}
	});

	var viewModel = lang.mixin(bind({
		textToAdd: "",
		addButton: "Add"
	}), {
		_count: count,
		_activeCount: activeCount,
		_finishedCount: finishedCount,
		_allSelected: bind(function(mode){
			return !/^(active|finished)$/.test(mode);
		}).to(filterMode),
		_activeSelected: bind(function(mode){
			return mode == "active";
		}).to(filterMode),
		_finishedSelected: bind(function(mode){
			return mode == "finished";
		}).to(filterMode),
		_exists: bind(function(count){
			return count == 0;
		}).to(unfilteredCount),
		_allButton: bind(function(count){
			return "All (" + count + ")";
		}).to(count),
		_activeButton: bind(function(count){
			return "Active (" + count + ")";
		}).to(activeCount),
		_finishedButton: bind(function(count){
			return "Finished (" + count + ")";
		}).to(finishedCount),
		collection: unfiltered,
		addEntry: function(event, binding, viewModelBinding){
			var textToAdd = viewModelBinding.get("textToAdd");
			textToAdd.getValue(function(text){
				collection.add({title: text, finished: false});
			});
			textToAdd.is("");
		},
		removeEntry: function(event, binding, viewModelBinding){
			viewModelBinding.get("id", function(id){
				collection.remove(id);
			});
		},
		filter: function(event, binding){
			binding.get("filterMode", function(mode){
				filterMode.is(mode);
			});
		}
	});

	return viewModel;
});