define(["./bind"], function(bind){
	var undef,
		childrenStandard,
		tmpDiv,
		tmpDoc,
		resettableForeach = bind.createOwnFunc("resetForeach"),
		ElementBinding = bind.Element;

	function isArray(it){
		return typeof it == "array" || typeof it == "object" && it.splice;
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

	function destroyNode(node){
		if(!tmpDiv || tmpDoc != node.ownerDocument){
			tmpDiv = (tmpDoc = node.ownerDocument).createElement("div");
		}
		tmpDiv.appendChild(node.parentNode ? node.parentNode.removeChild(node) : node);
		tmpDiv.innerHTML = "";
	}

	function foreach(collection){
		var self = this,
			binding = this.isSnapshot ? this.source : this,
			element = (binding.object || {}).containerNode || (binding.object || {}).domNode || binding.object,
			createChild = binding.using(bind.createChild) || element.tagName == "SELECT" && createOption,
			insertedChild = binding.using(bind.insertedChild),
			destroyChild = binding.using(bind.destroyChild) || bind.destroy,
			parent = binding.using(bind.parent);

		function watchElementCallback(idx, removals, adds){
			var i,
				l,
				next,
				child = childElement(element, idx);
			for(i = 0, l = removals.length; i < l; ++i){
				if(child){
					for(next = child.nextSibling; next && next.nodeType != 1; next = next.nextSibling);
					destroyChild.call(self, child);
					destroyNode(child);
					child = next;
				}
				// Though we may create a new binding for added entries, entries being removed from collection may be referred by other correction.
				// Therefore we cannot destroy binding for removed entries.
				// It's application's responsibility to destroy binding for collections entries as needed.
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

		this.resetForeach();
		watchElementCallback(0, isArray(this.foreach) ? this.foreach : [], isArray(collection) ? collection : []);
		(collection || {}).watchElements && resettableForeach.call(this, collection.watchElements(watchElementCallback));
		this.foreach = collection;
		return this;
	}

	var SnapshotBindingProto = (bind.Snapshot || {}).prototype || {};
	ElementBinding.prototype.foreach = SnapshotBindingProto.foreach = foreach;
	ElementBinding.prototype.resetForeach = function(){};
	SnapshotBindingProto.resetForeach = function(){};

	for(var s in {
		createChild: 1,
		insertedChild: 1,
		destroyChild: 1,
		parent: 1
	}){
		bind[s] = s;
	}

	return bind;
});