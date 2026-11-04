import sys, os, importlib.util, shutil
# copy/_build -> aso-v4 -> store-previews -> marketing -> repo root
PLAY = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', '..', 'store', 'play'))
sys.path.insert(0, PLAY)
spec = importlib.util.spec_from_file_location('cm', os.path.join(PLAY, 'check-metadata.py'))
cm = importlib.util.module_from_spec(spec); spec.loader.exec_module(cm)
stage = sys.argv[1]
# Full copy of the live metadata, with our locales overlaid, so the gate's locale ratchet passes.
tmp = stage + '-full'
shutil.rmtree(tmp, ignore_errors=True)
shutil.copytree(os.path.join(PLAY, 'metadata'), tmp)
for loc in os.listdir(stage):
    for f in os.listdir(os.path.join(stage, loc)):
        shutil.copy(os.path.join(stage, loc, f), os.path.join(tmp, loc, f))
cm.BASE = tmp
sys.exit(cm.main())
