define([
	"./bind",
	"dojox/mvc/StatefulArray"
], function(bind, StatefulArray){
	var undef;

	function indexOf(a, elem){
		if(a.indexOf){
			return a.indexOf(elem);
		}
		for(var i = 0, l = a.length; i < l; ++i){
			if(a[i] === elem){
				return i;
			}
		}
		return -1;
	}

	function filter(a, fn){
		if(a.filter){
			return a.filter(fn);
		}
		var filtered = [];
		for(var i = 0, l = a.length; i < l; ++i){
			fn(a[i], i, a) && filtered.push(a[i]);
		}
		return filtered;
	}

	function map(a, fn){
		if(a.map){
			return a.map(fn);
		}
		var mapped = [];
		for(var i = 0, l = a.length; i < l; ++i){
			mapped.push(fn(a[i], i, a));
		}
		return mapped;
	}

	function differenceIndex(a, b){
		var tokensA = a.split("/"),
			tokensB = b.split("/");
		for(var i = 0, l = Math.max(tokensA.length, tokensB.length); i < l; ++i){
			var difference = (tokensA[i] !== undef ? tokensA[i] : Infinity) - (tokensB[i] !== undef ? tokensB[i] : Infinity);
			if(difference != 0){
				return difference;
			}
		}
		return 0;
	}

	function nearest(a, entry, fn){
		fn = fn || function(a, b){ return a - b; };
		if(a.length == 0 || fn(a[0], entry) > 0){ return 0; }
		for(var s = 0, e = a.length, p = NaN, prev = NaN;; prev = p){
			p = s + Math.floor((e - s) / 2);
			var difference = fn(a[p], entry);
			if(p == prev){
				return p + 1; // If there is no matching entry though the index is converged, take larger index
			}else if(difference == 0){
				return p; // If there is a matching entry, return its index
			}else if(difference > 0){
				e = p;
			}else{
				s = p;
			}
		}
	}

	function convertElementUpdateCallback(a, watchElementsCallback){
		var spliceGuard,
			origSplice = a.splice;
		a.splice = function(){
			spliceGuard = true;
			try{
				origSplice.apply(this, arguments);
			}finally{
				spliceGuard = false;
			}
		};
		a.watch(function(name, old, current){
			if(!isNaN(name) && old !== current && !spliceGuard){
				watchElementsCallback(name, [old], [current]);
			}
		});
	}

	function LastVersionArray(a){
		var change,
			lva = new StatefulArray([]);
		function watchElementsCallback(idx, removals, adds){
			change && lva.splice.apply(lva, change);
			change = [idx, removals.length].concat(adds);
		}
		a.watchElements(watchElementsCallback);
		watchElementsCallback(0, [], a);
		return lva;
	}

	function ManagedHandleList(a, create, release){
		var handles = new StatefulArray([]);
		function watchElementsCallback(idx, removals, adds){
			idx = removals && adds ? idx : 0;
			handles.splice.apply(handles, [idx, map(handles.slice(idx, idx + (removals || a).length), release).length].concat(map(adds || a, function(add, i){ create(add, idx + i); })));
		}
		a.watchElements(watchElementsCallback);
		watchElementsCallback(0, [], a);
		convertElementUpdateCallback(a, watchElementsCallback);
		return handles;
	}

	function ArrayIndices(a){
		var indices = new StatefulArray([]);
		function watchElementsCallback(idx, removals, adds){
			idx = removals && adds ? idx : 0;
			var targetIndex = indices[idx],
				previousTargetIndex = indices[idx - 1],
				keyBase = targetIndex ? (targetIndex + "/") : "",
				startWith = targetIndex || !previousTargetIndex ? 0 : (+previousTargetIndex.split(".")[0] + 1);
			indices.splice.apply(indices, [idx, (removals || a).length].concat(map(adds || a, function(index, i){
				return keyBase + (startWith + i);
			})));
		}
		a.watchElements(watchElementsCallback);
		watchElementsCallback(0, [], a);
		convertElementUpdateCallback(a, watchElementsCallback);
		return indices;
	}

	function FilteredArrayIndices(a, fn){
		var lva = new LastVersionArray(a),
			filtered = new StatefulArray([]);
		function getWatchElementsCallback(fnRemovals){
			function watchElementsCallback(idx, removals, adds){
				var selfChange = idx === true;
				function getFilterFunc(removal){
					return function(entry){
						return ((removal ? fnRemovals : undef) || fn)(entry, {removal: removal, selfChange: selfChange});
					};
				}
				idx = removals && adds ? idx : 0;
				var baseIndex = (selfChange ? a : lva)[idx],
					targetIndex = baseIndex ? nearest(filtered, baseIndex, differenceIndex) : filtered.length;
				filtered.splice.apply(filtered, [targetIndex, filter(removals || a, getFilterFunc(true)).length].concat(filter(adds || a, getFilterFunc())));
			}
			return watchElementsCallback;
		}
		var watchElementsCallback = getWatchElementsCallback();
		a.watchElements(watchElementsCallback);
		watchElementsCallback(0, [], a);
		convertElementUpdateCallback(a, watchElementsCallback);
		filtered.apply = function(newFn){
			var watchElementsCallback = getWatchElementsCallback(fn);
			fn = newFn;
			watchElementsCallback(true);
		};
		return filtered;
	}

	function getHandleListParams(filterFn, filtered, indices, filteredIndices){
		return {
			create: function(entry, i){
				var promises = {},
					index = indices[i];
				if(typeof entry == "object"){
					bind(entry).keys(function(i, child){
						var activated;
						promises[i] = child.then(function(){
							if(activated){
								var targetIndex = nearest(filteredIndices, index, differenceIndex),
									foundInOld = filteredIndices[targetIndex] === index,
									foundInCurrent = filterFn(entry);
								if(foundInOld ^ foundInCurrent){
									filteredIndices.splice.apply(filteredIndices, [targetIndex, !!foundInOld - 0].concat(foundInCurrent ? [index] : []));
									filtered.splice.apply(filtered, [targetIndex, !!foundInOld - 0].concat(foundInCurrent ? [entry] : []));
								}
							}
						});
						activated = true;
					});
				}
				return promises;
			},
			destroy: function(entry){
				for(var key in entry){
					entry[key].cancel();
				}
			},
			apply: function(fn){
				filterFn = fn;
			}
		};
	}

	function FilteredStatefulArray(a, fn){
		fn = fn || function(){ return true; };

		function createFilterArrayIndicesCallback(fn){
			return function(index, options){
				var entry = (options.removal && !options.selfChange ? lastVersion : a)[indexOf(options.removal && !options.selfChange ? lastVersionIndices : indices, index)];
				return entry && fn(entry);
			};
		}

		var lastVersion = new LastVersionArray(a),
			indices = new ArrayIndices(a),
			lastVersionIndices = new LastVersionArray(indices),
			filteredIndices = new FilteredArrayIndices(indices, createFilterArrayIndicesCallback(fn)),
			filtered = new StatefulArray([]),
			handleListParams = getHandleListParams(fn, filtered, indices, filteredIndices);

		new ManagedHandleList(a, handleListParams.create, handleListParams.destroy);

		function getWatchElementsCallback(fnRemovals){
			function watchElementsCallback(idx, removals, adds){
				var selfChange = idx === true;
				function getFilterFunc(removal){
					return function(entry){
						return ((removal ? fnRemovals : undef) || fn)(entry, {removal: removal, selfChange: selfChange});
					};
				}
				idx = removals && adds ? idx : 0;
				removals = removals || a;
				adds = adds || a;
				var baseIndex = (selfChange ? indices : lastVersionIndices)[idx],
					targetIndex = baseIndex ? nearest(filteredIndices, baseIndex, differenceIndex) : filteredIndices.length;
				filtered.splice.apply(filtered, [targetIndex, filter(removals, getFilterFunc(true)).length].concat(filter(adds, getFilterFunc())));
			}
			return watchElementsCallback;
		}

		var watchElementsCallback = getWatchElementsCallback();
		a.watchElements(watchElementsCallback);
		watchElementsCallback(0, [], a);
		convertElementUpdateCallback(a, watchElementsCallback);

		filtered.apply = function(newFn){
			handleListParams.apply(newFn);
			filteredIndices.apply(createFilterArrayIndicesCallback(newFn));
			var watchElementsCallback = getWatchElementsCallback(fn);
			fn = newFn;
			watchElementsCallback(true);
		};

		return filtered;
	}

	return FilteredStatefulArray;
});