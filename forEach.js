define(["./bind"], function(bind){
	var undef,
		childrenStandard,
		tmpDiv,
		tmpDoc,
		resettableForEach = bind.createOwnFunc("resetForEach"),
		ElementBinding = bind.Element;

	function when(value, callback){
		if(value && value.then){
			return value.then(callback);
		}
		return callback(value);
	}

	function isArray(it){
		return typeof it == "object" && it.splice;
	}
	isArray = Array.isArray || isArray;

	function createOption(entry){
		var doc = (this.object.ownerDocument || document),
			option = doc.createElement("option");
		bind(option).to(entry);
		return option;
	}

	function childElement(element, idx){
		if(childrenStandard === undef){
			var div = tmpDiv || document.createElement("div");
			tmpDoc = tmpDoc || document;
			div.innerHTML = "<a>a</a><!-- Hoge -->";
			childrenStandard = div.children.length == 1;
		}
		if(childrenStandard){
			return element.children[idx];
		}
		var ref = element.firstChild;
		for(; ref && idx > 0; ref = ref.nextSibling){
			if(ref.nodeType == 1){ --idx; }
		}
		return ref;
	}

	function removeNode(node){
		if(!tmpDiv || tmpDoc != node.ownerDocument){
			tmpDiv = (tmpDoc = node.ownerDocument).createElement("div");
		}
		tmpDiv.appendChild(node.parentNode ? node.parentNode.removeChild(node) : node);
		tmpDiv.innerHTML = "";
	}

	function forEach(collection, options){
		var self = this,
			binding = this.isSnapshot ? this.source : this,
			element = (binding.stateful || {}).containerNode || (binding.stateful || {}).domNode || binding.element,
			createChild = options.createChild || element.tagName == "SELECT" && createOption,
			insertedChild = options.insertedChild,
			removeChild = options.removeChild || bind.remove,
			parent = options.parent;

		function observe(idx, removals, adds){
			var i,
				l,
				next,
				child = childElement(element, idx);
			for(i = 0, l = removals.length; i < l; ++i){
				if(child){
					for(next = child.nextSibling; next && next.nodeType != 1; next = next.nextSibling);
					removeChild.call(self, child);
					removeNode(child);
					child = next;
				}
				// Though we may create a new binding for added entries, entries being removed from collection may be referred by other correction.
				// Therefore we cannot remove binding for removed entries.
				// It's application's responsibility to remove binding for collections entries as needed.
			}
			for(i = 0, l = adds.length; i < l; ++i){
				if(parent){
					bind(adds[i]).parent = parent;
				}
				var created = createChild.call(self, adds[i]);
				element.insertBefore(created, child || null);
				if(insertedChild){
					insertedChild.call(self, created);
				}
			}
			if(element.tagName == "SELECT"){
				var container = bind(element);
				container.getValue(function(value){
					// Re-apply the value in case there was not a match in older collection but there was in newer collection
					container.setValue("");
					container.setValue(value);
				});
			}
		}

		this.resetForEach();
		when(collection, function(a){
			observe(0, isArray(this.forEach) ? this.forEach : [], a);
			this.forEach = a;
		});
		(collection || {}).observe && resettableForEach.call(this, collection.observe(observe, true, true));
		return this;
	}

	var SnapshotBindingProto = (bind.Snapshot || {}).prototype || {};
	ElementBinding.prototype.forEach = SnapshotBindingProto.forEach = forEach;
	ElementBinding.prototype.resetForEach = function(){};
	SnapshotBindingProto.resetForEach = function(){};

	return bind;
});