define(["./bind"], function(bind){
	var eo = {},
		opts = {}.toString,
		Binding = bind.Binding;

	function isFunction(it){
		return opts.call(it) === "[object Function]";
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

	function SelectionBinding(){
		Binding.apply(this, arguments);
	}
	SelectionBinding.prototype = new Binding();
	SelectionBinding.prototype.create = function(collection){
		var he, hp, spliceGuard,
			origSplice = collection.splice;

		collection.splice = function(){
			spliceGuard = true;
			origSplice.apply(this, arguments);
			spliceGuard = false;
		};

		this.use = function(){
			Binding.prototype.use.apply(this, arguments);
			this.to();
		};

		this.to = function(fn){
			if(arguments.length > 0 && !isFunction(fn)){
				return Binding.prototype.to.apply(this, arguments);
			}

			var self = this,
				fallback = this.using(SelectionBinding.fallbackSelection);

			function apply(){
				var found = fn && filter(collection, fn)[0],
					binding = bind(found || fallback && collection[0] || eo),
					target = self.using(bind.keepSnapshot) ? binding.use(bind.keepSnapshot) : binding;
				self.to(target);
				self.using(bind.keepSnapshot) && self.snapshot().to(target.snapshot());
			}

			he && he.remove();
			hp && hp.remove();

			he = collection.watchElements(function(){
				apply();
			});
			hp = collection.watch(function(name, old, current){
				if(!spliceGuard && !isNaN(name) && old !== current){
					apply();
				}
			});
			apply();
		};

		collection._binding = this;
		Binding.prototype.create.call(this);
	};
	SelectionBinding.prototype.canuse = function(option){
		return Binding.prototype.canuse(option) || (option in SelectionBinding);
	};
	SelectionBinding.prototype.snapshot = function(){
		return this._ || this.own(this._ = new Binding())[0]; // Returns a binding, which should eventually be synced to selection's snapshot
	};
	SelectionBinding.prototype.push = function(){
		this.source && this.source.push();
	};
	SelectionBinding.prototype.pull = function(){
		this.source && this.source.pull();
	};

	bind.register(function(object){
		return (object || {})._binding || (object || {}).watchElements && new SelectionBinding(object);
	});

	SelectionBinding.fallbackSelection = "fallbackSelection";
	return SelectionBinding;
});
