define(["./bind"], function(bind){
	var Binding = bind.Binding;

	function SnapshotBinding(){
		Binding.apply(this, arguments);
	}
	SnapshotBinding.prototype = new Binding();
	SnapshotBinding.prototype.get = function(key){
		this['_' + key] || (this['_' + key] = this.own(new SnapshotBinding().to(this.source && this.source.get(key)))[0]);
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
		var self = source._ = this;
		source.getValue(function(value){
			self.is(value);
		});
		return this.enumerate();
	};
	SnapshotBinding.prototype.snapshot = function(){};
	SnapshotBinding.prototype.pull = function(){
		var self = this;
		this.source.getValue(function(value){
			self.is(value);
		});
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

	function SnapshotExtension(){
		this.extension = true;
	}
	SnapshotExtension.prototype.start = function(){
		this.snapshot().to(this);
	};
	SnapshotExtension.prototype.snapshot = function(){
		return this._ || this.own(new SnapshotBinding())[0];
	};
	SnapshotExtension.prototype.dirty = function(){
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
	SnapshotExtension.prototype.pull = function(){
		this._ && this._.push();
	};
	SnapshotExtension.prototype.push = function(){
		this._ && this._.pull();
	};

	return SnapshotExtension;
});