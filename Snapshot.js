define(["./bind"], function(bind){
	var Binding = bind.Binding;

	function SnapshotBinding(){
		Binding.apply(this, arguments);
	}
	SnapshotBinding.prototype = new Binding();
	SnapshotBinding.prototype.create = function(binding){
		binding && this.to(binding);
		Binding.prototype.create.call(this);
	};
	SnapshotBinding.prototype.get = function(key){
		this['_' + key] || (this['_' + key] = this.own(new SnapshotBinding(this.source && this.source.get(key)))[0]);
		return Binding.prototype.get.apply(this, arguments);
	};
	SnapshotBinding.prototype.put = function(value){
		this.is(value);
	};
	SnapshotBinding.prototype.to = function(source, property){
		this.reset();
		source = bind(source);
		if(property){
			source = source.get(property);
		}
		this.source = source;
		if(source._ && source._ != this){
			source._.destroy();
		}
		source._ = this;
		var got,
			self = this,
			h = this.resettable(source.then(function(value){
				self.is(value);
				h && h.cancel();
				got = true;
			}))[0];
		got && h.cancel();
		return this.enumerate();
	};
	SnapshotBinding.prototype.snapshot = function(){};
	SnapshotBinding.prototype.pull = function(){
		var got,
			self = this,
			h = this.resettable(this.source.then(function(value){
				self.is(value);
				h && h.cancel();
				got = true;
			}))[0];
			got && h && h.cancel();
		this.keys(function(i, child){
			child.pull();
		});
	};
	SnapshotBinding.prototype.push = function(){
		var self = this;
		this.getValue(function(value){
			self.source.put(value);
		});
		this.keys(function(i, child){
			child.push();
		});
	};

	var ElementBinding = bind.Element;
	if(ElementBinding.prototype.foreach){
		SnapshotBinding.prototype.foreach = ElementBinding.prototype.foreach;
		SnapshotBinding.prototype.resetForeach = function(){};
	}

	bind.Snapshot = SnapshotBinding;

	Binding.prototype.snapshot = function(){
		return this._ || this.own(new SnapshotBinding(this))[0];
	};
	Binding.prototype.dirty = function(){
		var dirty,
			snapshot = this._;
		if(snapshot){
			this.getValue(function(value){
				snapshot.getValue(function(snapValue){
					snapValue != value && (dirty = true);
				});
			});
			!dirty && this.keys(function(i, child){
				child.dirty() && (dirty = true);
			});
			return dirty;
		}
	};
	Binding.prototype.pull = function(){
		this._ && this._.push();
	};
	Binding.prototype.push = function(){
		this._ && this._.pull();
	};

	var origUse = Binding.prototype.use;
	Binding.prototype.use = function(){
		var ret = origUse.apply(this, arguments);
		this.using(bind.keepSnapshot) && this.snapshot();
		return ret;
	};

	var origTo = Binding.prototype.to;
	Binding.prototype.to = function(){
		var ret = origTo.apply(this, arguments);
		this.using(bind.keepSnapshot) && this.snapshot().to(this);
		return ret;
	};

	var FunctionBinding = bind.Function,
		origFuncTo = FunctionBinding.prototype.to;
	FunctionBinding.prototype.to = function(){
		var ret = origFuncTo.apply(this, arguments);
		this.using(bind.keepSnapshot) && this.snapshot().to(this);
		return ret;
	};

	bind.keepSnapshot = "keepSnapshot";
	return bind;
});
