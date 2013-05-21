define(['dojo/when'], function(when){
	// a navigation binding, that can receive and trigger data through the binding to control
	// the navigation history
	return function(target, options){
		// provide a store and a prefix
		options = options || {};
		var store = options.store;
		var prefix = options.prefix || '';
		var usePushState = options.usePushState;
		var currentPath;
		// listen for changes in the data
		target.receive(function(object){
			var id = store.getIdentity(object);
			if(id !== undefined){
				currentPath = prefix + id;
				if(usePushState){
					if(location.pathname != currentPath){ 
						location.pushState(currentPath);
					}
				}else{
					if(location.hash != currentPath){
						location.hash = currentPath;
					}
				}
			}
		});
		// listen for changes in the hash
		addEventListener('hashchange', update, false);
		// do it at the beginning too
		update();
		function update(){
			// in response to URL change or startup
			var path = usePushState ? 
				location.pathname :
				location.hash;
			if(path.charAt(0) == '#'){
				path = path.slice(1);
			}
			if(currentPath != path){
				// only change if it matches or accepted prefixes
				if(path.slice(0, prefix.length) == prefix){
					when(store.get(path.slice(prefix.length)), function(object){
						if(object){
							target.put(object);
						}
					});
				}
			}
		}
		return target;
	};
});